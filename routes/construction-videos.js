const express = require('express');
const router = express.Router();
const ConstructionVideo = require('../models/ConstructionVideo');

// Utility to extract clean YouTube ID from various YouTube URL formats
function extractYouTubeId(url) {
  if (!url) return null;
  const str = url.trim();
  // Standard 11 character ID regex for youtube
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = str.match(regExp);

  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  // If user pasted raw 11 char ID directly
  if (str.length === 11 && !str.includes('/') && !str.includes('.')) {
    return str;
  }
  return null;
}

// GET all videos (supports filters: stageNumber, language, isActive, search)
router.get('/', async (req, res) => {
  try {
    const { stageNumber, language, isActive, search } = req.query;
    const filter = {};

    if (stageNumber) filter.stageNumber = Number(stageNumber);
    if (language && language !== 'All') filter.language = language;
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (search) {
      filter.$or = [
        { videoTitle: { $regex: search, $options: 'i' } },
        { stageName: { $regex: search, $options: 'i' } },
        { channelName: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } }
      ];
    }

    const videos = await ConstructionVideo.find(filter)
      .sort({ stageNumber: 1, displayOrder: 1, createdAt: -1 });

    res.json({
      success: true,
      count: videos.length,
      videos
    });
  } catch (error) {
    console.error('Error fetching construction videos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST add new video
router.post('/', async (req, res) => {
  try {
    const {
      stageNumber,
      stageName,
      videoTitle,
      youtubeUrl,
      language,
      channelName,
      duration,
      shortDescription,
      displayOrder,
      isActive
    } = req.body;

    if (!stageNumber || !stageName || !videoTitle || !youtubeUrl || !channelName) {
      return res.status(400).json({
        success: false,
        message: 'stageNumber, stageName, videoTitle, youtubeUrl, and channelName are required fields.'
      });
    }

    const youtubeId = extractYouTubeId(youtubeUrl);
    if (!youtubeId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid YouTube URL or YouTube ID. Please enter a valid YouTube link.'
      });
    }

    // Check duplicate youtubeId
    const existing = await ConstructionVideo.findOne({ youtubeId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Video with YouTube ID ${youtubeId} already exists under Stage ${existing.stageNumber}: "${existing.stageName}".`
      });
    }

    // Calculate display order if not provided
    let calculatedOrder = displayOrder;
    if (calculatedOrder === undefined || calculatedOrder === null) {
      const highestOrderDoc = await ConstructionVideo.findOne({ stageNumber: Number(stageNumber) })
        .sort({ displayOrder: -1 });
      calculatedOrder = highestOrderDoc ? highestOrderDoc.displayOrder + 1 : 1;
    }

    const normalizedUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    const newVideo = new ConstructionVideo({
      stageNumber: Number(stageNumber),
      stageName: stageName.trim(),
      videoTitle: videoTitle.trim(),
      youtubeUrl: normalizedUrl,
      youtubeId,
      language: language || 'Kannada',
      channelName: channelName.trim(),
      duration: duration || 'N/A',
      shortDescription: shortDescription || '',
      displayOrder: Number(calculatedOrder),
      isActive: isActive !== undefined ? isActive : true
    });

    await newVideo.save();

    res.status(201).json({
      success: true,
      message: 'Construction video created successfully',
      video: newVideo
    });
  } catch (error) {
    console.error('Error creating construction video:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update video
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.youtubeUrl) {
      const youtubeId = extractYouTubeId(updates.youtubeUrl);
      if (!youtubeId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid YouTube URL provided.'
        });
      }
      // Check duplicate if youtubeId changed
      const existing = await ConstructionVideo.findOne({ youtubeId, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Another video already uses YouTube ID ${youtubeId}.`
        });
      }
      updates.youtubeId = youtubeId;
      updates.youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    }

    if (updates.stageNumber) updates.stageNumber = Number(updates.stageNumber);
    if (updates.displayOrder !== undefined) updates.displayOrder = Number(updates.displayOrder);

    const updatedVideo = await ConstructionVideo.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedVideo) {
      return res.status(404).json({ success: false, message: 'Video record not found' });
    }

    res.json({
      success: true,
      message: 'Video updated successfully',
      video: updatedVideo
    });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE video
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedVideo = await ConstructionVideo.findByIdAndDelete(id);

    if (!deletedVideo) {
      return res.status(404).json({ success: false, message: 'Video record not found' });
    }

    res.json({
      success: true,
      message: 'Video record deleted successfully',
      video: deletedVideo
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST reorder videos within a stage or global
router.post('/reorder', async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, displayOrder }
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }

    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { displayOrder: Number(item.displayOrder) } }
      }
    }));

    if (bulkOps.length > 0) {
      await ConstructionVideo.bulkWrite(bulkOps);
    }

    res.json({
      success: true,
      message: 'Videos reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering videos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST seed / bulk insert construction videos
router.post('/seed', async (req, res) => {
  try {
    const { videos, reset } = req.body;

    if (!Array.isArray(videos)) {
      return res.status(400).json({ success: false, message: 'videos array is required' });
    }

    if (reset) {
      await ConstructionVideo.deleteMany({});
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const vid of videos) {
      const youtubeId = extractYouTubeId(vid.youtubeUrl || vid.youtubeId);
      if (!youtubeId) {
        skippedCount++;
        continue;
      }

      const normalizedUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

      const existing = await ConstructionVideo.findOne({ youtubeId });
      if (existing) {
        skippedCount++;
        continue;
      }

      await ConstructionVideo.create({
        stageNumber: Number(vid.stageNumber),
        stageName: vid.stageName.trim(),
        videoTitle: vid.videoTitle.trim(),
        youtubeUrl: normalizedUrl,
        youtubeId,
        language: vid.language || 'Kannada',
        channelName: vid.channelName ? vid.channelName.trim() : 'BuildMitra Learning',
        duration: vid.duration || 'N/A',
        shortDescription: vid.shortDescription || '',
        displayOrder: Number(vid.displayOrder || 1),
        isActive: vid.isActive !== undefined ? vid.isActive : true
      });
      insertedCount++;
    }

    res.json({
      success: true,
      message: `Seeding completed: ${insertedCount} inserted, ${skippedCount} skipped (duplicates/invalid)`,
      insertedCount,
      skippedCount
    });
  } catch (error) {
    console.error('Error seeding construction videos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
