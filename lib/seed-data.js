/**
 * Sample game data for testing.
 * Matches the schema in supabase/migrations/00001_create_schema.sql:
 * games -> questions -> question_choices
 * (Scoring bands and game_settings are auto-created by DB triggers.)
 */

export const SAMPLE_GAME = {
  name: "General Knowledge Quiz",
  questions: [
    {
      question_order: 1,
      question_text: "What is the capital of France?",
      category: "Geography",
      choices: [
        { choice_key: "A", choice_text: "London", is_correct: false },
        { choice_key: "B", choice_text: "Berlin", is_correct: false },
        { choice_key: "C", choice_text: "Paris", is_correct: true },
        { choice_key: "D", choice_text: "Madrid", is_correct: false }
      ]
    },
    {
      question_order: 2,
      question_text: "Which planet is known as the Red Planet?",
      category: "Science",
      choices: [
        { choice_key: "A", choice_text: "Venus", is_correct: false },
        { choice_key: "B", choice_text: "Mars", is_correct: true },
        { choice_key: "C", choice_text: "Jupiter", is_correct: false },
        { choice_key: "D", choice_text: "Saturn", is_correct: false }
      ]
    },
    {
      question_order: 3,
      question_text: "What is the largest ocean on Earth?",
      category: "Geography",
      choices: [
        { choice_key: "A", choice_text: "Atlantic Ocean", is_correct: false },
        { choice_key: "B", choice_text: "Indian Ocean", is_correct: false },
        { choice_key: "C", choice_text: "Arctic Ocean", is_correct: false },
        { choice_key: "D", choice_text: "Pacific Ocean", is_correct: true }
      ]
    },
    {
      question_order: 4,
      question_text: "Who painted the Mona Lisa?",
      category: "Art",
      choices: [
        { choice_key: "A", choice_text: "Vincent van Gogh", is_correct: false },
        { choice_key: "B", choice_text: "Leonardo da Vinci", is_correct: true },
        { choice_key: "C", choice_text: "Pablo Picasso", is_correct: false },
        { choice_key: "D", choice_text: "Michelangelo", is_correct: false }
      ]
    },
    {
      question_order: 5,
      question_text: "What is the chemical symbol for gold?",
      category: "Science",
      choices: [
        { choice_key: "A", choice_text: "Go", is_correct: false },
        { choice_key: "B", choice_text: "Gd", is_correct: false },
        { choice_key: "C", choice_text: "Au", is_correct: true },
        { choice_key: "D", choice_text: "Ag", is_correct: false }
      ]
    }
  ]
};
