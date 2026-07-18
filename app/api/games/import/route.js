import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionsWorkbook } from "@/lib/xlsx-import";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, per spec section 10.9

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const gameName = (formData.get("name") || "").toString().trim();
    const dryRun = formData.get("dryRun") === "true";

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds the 5 MB size limit" }, { status: 400 });
    }
    if (!gameName && !dryRun) {
      return NextResponse.json({ error: "Game name is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseQuestionsWorkbook(buffer);

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.errors,
          warnings: parsed.warnings,
          questions: parsed.questions,
          question_count: parsed.questions.length
        },
        { status: 422 }
      );
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        preview: true,
        errors: [],
        warnings: parsed.warnings,
        questions: parsed.questions,
        question_count: parsed.questions.length,
        game_settings: parsed.gameSettings,
        scoring_bands: parsed.scoringBands
      });
    }

    // Persist. No partial games: if any step fails, delete the game (cascades
    // remove any questions/choices/settings/bands already inserted for it).
    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({ owner_id: user.id, name: parsed.gameSettings?.name || gameName })
      .select()
      .single();

    if (gameError) {
      return NextResponse.json({ error: gameError.message }, { status: 500 });
    }

    try {
      for (const q of parsed.questions) {
        const { data: question, error: questionError } = await supabase
          .from("questions")
          .insert({
            game_id: game.id,
            question_order: q.question_order,
            question_text: q.question_text,
            category: q.category,
            explanation: q.explanation,
            image_url: q.image_url
          })
          .select()
          .single();

        if (questionError) throw new Error(questionError.message);

        const choicesToInsert = q.choices.map((c) => ({
          question_id: question.id,
          choice_key: c.choice_key,
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          display_order: c.display_order
        }));
        const { error: choicesError } = await supabase.from("question_choices").insert(choicesToInsert);
        if (choicesError) throw new Error(choicesError.message);
      }

      if (parsed.gameSettings) {
        const settingsUpdate = {};
        for (const key of [
          "max_players",
          "preparation_countdown_seconds",
          "leaderboard_duration_seconds",
          "allow_late_join",
          "randomize_questions",
          "randomize_answers",
          "show_correct_answer",
          "show_leaderboard_after_question"
        ]) {
          if (parsed.gameSettings[key] !== undefined) settingsUpdate[key] = parsed.gameSettings[key];
        }
        if (Object.keys(settingsUpdate).length > 0) {
          const { error: settingsError } = await supabase.from("game_settings").update(settingsUpdate).eq("game_id", game.id);
          if (settingsError) throw new Error(settingsError.message);
        }
      }

      if (parsed.scoringBands) {
        const { error: deleteError } = await supabase.from("scoring_bands").delete().eq("game_id", game.id);
        if (deleteError) throw new Error(deleteError.message);

        const bandsToInsert = parsed.scoringBands.map((b) => ({
          game_id: game.id,
          start_ms: b.start_ms,
          end_ms: b.end_ms,
          points: b.points,
          is_final_band: b.is_final_band,
          display_order: b.display_order
        }));
        const { error: bandsError } = await supabase.from("scoring_bands").insert(bandsToInsert);
        if (bandsError) throw new Error(bandsError.message);
      }
    } catch (persistError) {
      await supabase.from("games").delete().eq("id", game.id);
      return NextResponse.json({ error: persistError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      game_id: game.id,
      warnings: parsed.warnings,
      question_count: parsed.questions.length
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
