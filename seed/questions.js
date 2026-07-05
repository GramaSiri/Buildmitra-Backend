const mongoose = require('mongoose');
const Question = require('../models/Question');
require('dotenv').config();

// Categories
const categories = [
  'Foundation', 'Materials', 'Construction', 'Structural', 
  'Plumbing', 'Concrete', 'Regulations', 'Design', 
  'Roofing', 'Testing', 'Surveying', 'Estimation'
];

const questions = [];

// Generate questions for each category
categories.forEach(category => {
  const topics = [
    'foundation design', 'soil testing', 'concrete mixing', 'steel reinforcement',
    'formwork', 'curing', 'waterproofing', 'insulation', 'drainage', 'ventilation',
    'structural analysis', 'load calculation', 'material testing', 'quality control',
    'safety standards', 'building codes', 'environmental compliance', 'project management'
  ];
  
  for (let i = 0; i < 55; i++) {
    const topic = topics[i % topics.length];
    const questionText = 'What is the standard practice for ' + topic + ' in ' + category + '?';
    
    questions.push({
      question: questionText,
      options: [
        'Standard method for ' + topic,
        'Alternative approach for ' + topic,
        'Recommended practice for ' + topic,
        'Best practice for ' + topic
      ],
      correctAnswer: Math.floor(Math.random() * 4),
      category: category,
      difficulty: ['Easy', 'Medium', 'Hard'][i % 3],
      explanation: 'The standard practice for ' + topic + ' in ' + category + ' ensures quality and safety.'
    });
  }
});

// Add some specific civil engineering questions
const specificQuestions = [
  {
    question: 'What is the minimum depth of foundation for a residential building on clayey soil?',
    options: ['0.5m', '1.0m', '1.5m', '2.0m'],
    correctAnswer: 1,
    category: 'Foundation',
    difficulty: 'Medium',
    explanation: 'For clayey soil, minimum foundation depth should be 1.0m to prevent frost heave.'
  },
  {
    question: 'Which type of foundation is best for areas with high water table?',
    options: ['Raft foundation', 'Pile foundation', 'Strip foundation', 'Isolated footing'],
    correctAnswer: 1,
    category: 'Foundation',
    difficulty: 'Medium',
    explanation: 'Pile foundations are ideal for high water table areas.'
  },
  {
    question: 'What is the standard size of a modular brick in India?',
    options: ['190mm x 90mm x 90mm', '200mm x 100mm x 100mm', '180mm x 80mm x 80mm', '210mm x 110mm x 110mm'],
    correctAnswer: 0,
    category: 'Materials',
    difficulty: 'Easy',
    explanation: 'The standard modular brick size in India is 190mm x 90mm x 90mm with 10mm mortar joint.'
  },
  {
    question: 'What is the minimum curing period for concrete?',
    options: ['3 days', '7 days', '14 days', '28 days'],
    correctAnswer: 1,
    category: 'Concrete',
    difficulty: 'Easy',
    explanation: 'Concrete should be cured for at least 7 days for proper strength development.'
  },
  {
    question: 'What is the standard water-cement ratio for high-quality concrete?',
    options: ['0.3', '0.45', '0.6', '0.75'],
    correctAnswer: 1,
    category: 'Concrete',
    difficulty: 'Medium',
    explanation: 'A water-cement ratio of 0.45 gives good workability and strength.'
  },
  {
    question: 'What does RERA stand for in Indian real estate?',
    options: ['Real Estate Regulation Authority', 'Real Estate Regulatory Act', 'Real Estate Revenue Authority', 'Regional Estate Regulation Act'],
    correctAnswer: 1,
    category: 'Regulations',
    difficulty: 'Easy',
    explanation: 'RERA stands for Real Estate Regulatory Act, 2016.'
  },
  {
    question: 'Which type of roof is best for hot and humid climates?',
    options: ['Flat roof', 'Sloped roof', 'Green roof', 'Metal roof'],
    correctAnswer: 1,
    category: 'Roofing',
    difficulty: 'Medium',
    explanation: 'Sloped roofs provide better ventilation and heat dissipation.'
  },
  {
    question: 'What is the minimum thickness of a load-bearing wall?',
    options: ['4 inches', '6 inches', '9 inches', '12 inches'],
    correctAnswer: 2,
    category: 'Structural',
    difficulty: 'Medium',
    explanation: 'Load-bearing walls should be at least 9 inches thick for stability.'
  },
  {
    question: 'Which test is used to measure the compressive strength of concrete?',
    options: ['Tensile test', 'Flexural test', 'Compression test', 'Impact test'],
    correctAnswer: 2,
    category: 'Testing',
    difficulty: 'Easy',
    explanation: 'Compression test measures the compressive strength of concrete cubes.'
  },
  {
    question: 'What is the standard slope for drainage pipes?',
    options: ['1:100', '1:50', '1:200', '1:25'],
    correctAnswer: 0,
    category: 'Plumbing',
    difficulty: 'Medium',
    explanation: 'A slope of 1:100 is standard for proper drainage flow.'
  }
];

// Add specific questions to the pool
specificQuestions.forEach(q => questions.push(q));

async function seedDatabase() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/buildmitra';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    // Clear existing questions
    await Question.deleteMany({});
    console.log('Removed existing questions');
    
    // Insert new questions
    await Question.insertMany(questions);
    console.log('✅ ' + questions.length + ' questions seeded successfully!');
    console.log('📊 Categories: ' + categories.join(', '));
    console.log('📝 Total questions: ' + questions.length);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
