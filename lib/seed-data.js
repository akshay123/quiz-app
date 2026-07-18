/**
 * Sample game data for testing
 * Based on General Knowledge trivia
 */

export const SAMPLE_GAME = {
  title: "General Knowledge Quiz",
  description: "Test your knowledge across science, history, geography, and more!",
  category: "Education",
  questions: [
    {
      number: 1,
      text: "What is the capital of France?",
      category: "Geography",
      options: ["London", "Berlin", "Paris", "Madrid"],
      correct_option: 2 // 0-indexed
    },
    {
      number: 2,
      text: "Which planet is known as the Red Planet?",
      category: "Science",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correct_option: 1
    },
    {
      number: 3,
      text: "What is the largest ocean on Earth?",
      category: "Geography",
      options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
      correct_option: 3
    },
    {
      number: 4,
      text: "Who painted the Mona Lisa?",
      category: "Art",
      options: ["Vincent van Gogh", "Leonardo da Vinci", "Pablo Picasso", "Michelangelo"],
      correct_option: 1
    },
    {
      number: 5,
      text: "What is the chemical symbol for gold?",
      category: "Science",
      options: ["Go", "Gd", "Au", "Ag"],
      correct_option: 2
    }
  ]
};

export const DEFAULT_GAME_SETTINGS = {
  max_players: 100,
  question_duration_seconds: 30,
  preparation_countdown_seconds: 3,
  leaderboard_display_seconds: 5,
  allow_answer_changes: false,
  scoring_rules: {
    correct_0_10s: 3,
    correct_10_20s: 2,
    correct_20_30s: 1,
    incorrect: 0
  }
};
