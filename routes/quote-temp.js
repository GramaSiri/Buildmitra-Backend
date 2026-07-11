router.get('/all', async (req, res) => {
  try {
    const quotes = await Quote.find({}).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, count: quotes.length, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
