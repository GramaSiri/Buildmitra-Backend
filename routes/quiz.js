const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Score = require('../models/Score');

// Get random questions
router.get('/questions', async (req, res) => {
  try {
    const { count = 20, category, difficulty } = req.query;
    let query = {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    
    // Get random questions using mongoose
    const questions = await Question.find(query).limit(parseInt(count));
    
    const sanitized = questions.map(q => ({
      id: q._id,
      question: q.question,
      options: q.options,
      category: q.category,
      difficulty: q.difficulty
    }));
    
    res.json({ success: true, questions: sanitized, total: questions.length });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit quiz
router.post('/submit', async (req, res) => {
  try {
    const { userId, userName, answers, questions: questionIds, timeTaken } = req.body;
    
    const dbQuestions = await Question.find({ _id: { $in: questionIds } });
    
    let correct = 0;
    dbQuestions.forEach((q, index) => {
      if (answers[index] === q.correctAnswer) correct++;
    });
    
    const score = Math.round((correct / dbQuestions.length) * 100);
    
    const scoreEntry = new Score({
      userId: userId || null,
      userName: userName || 'Guest',
      score: score,
      correctAnswers: correct,
      totalQuestions: dbQuestions.length,
      timeTaken: timeTaken,
      questionsAttempted: questionIds
    });
    await scoreEntry.save();
    
    res.json({
      success: true,
      score: score,
      correct: correct,
      total: dbQuestions.length,
      scoreId: scoreEntry._id
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get quiz history for user
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await Score.find({ userId: userId })
      .sort({ date: -1 })
      .limit(10)
      .select('score correctAnswers totalQuestions date');
    
    res.json({ success: true, history: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;