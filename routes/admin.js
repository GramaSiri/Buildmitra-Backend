const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const User = require('../models/User');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const usersFile = path.join(dataDir, 'users.json');
const complaintsFile = path.join(dataDir, 'complaints.json');
const offersFile = path.join(dataDir, 'offers.json');
const paymentsFile = path.join(dataDir, 'payments.json');

if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify([]));
if (!fs.existsSync(complaintsFile)) fs.writeFileSync(complaintsFile, JSON.stringify([]));
if (!fs.existsSync(offersFile)) fs.writeFileSync(offersFile, JSON.stringify([]));
if (!fs.existsSync(paymentsFile)) fs.writeFileSync(paymentsFile, JSON.stringify([]));

const read = (file) => JSON.parse(fs.readFileSync(file));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Mock admin check (header)
const requireAdmin = (req, res, next) => {
  if (req.headers['x-user-role'] !== 'admin') return res.status(403).json({ error: 'Admin required' });
  next();
};

router.get('/users', requireAdmin, (req, res) => {
  let users = read(usersFile);
  if (req.query.status) users = users.filter(u => u.status === req.query.status);
  res.json(users);
});

router.put('/users/:id/status', requireAdmin, (req, res) => {
  const users = read(usersFile);
  const user = users.find(u => u.id == req.params.id);
  if (user) {
    user.status = req.body.status;
    write(usersFile, users);
    res.json({ success: true });
  } else res.status(404).json({ error: 'User not found' });
});

router.get('/expiring-vendors', requireAdmin, (req, res) => {
  const users = read(usersFile);
  const now = new Date();
  const days = parseInt(req.query.days) || 7;
  const expiring = users.filter(u => u.role === 'vendor' && u.subscription_expiry).filter(u => {
    const expiry = new Date(u.subscription_expiry);
    const diff = (expiry - now) / (1000*60*60*24);
    return diff <= days && diff > 0;
  });
  res.json(expiring);
});

router.get('/vendor-ranking', requireAdmin, (req, res) => {
  const users = read(usersFile);
  const payments = read(paymentsFile);
  const revenue = {};
  payments.forEach(p => { if (p.vendor_id) revenue[p.vendor_id] = (revenue[p.vendor_id]||0) + p.amount; });
  const vendors = users.filter(u => u.role === 'vendor').map(v => ({
    id: v.id, name: v.name, revenue: revenue[v.id] || 0, projects: v.projects_completed || 0, rating: v.rating || 0
  }));
  vendors.sort((a,b) => b.revenue - a.revenue);
  res.json(vendors.slice(0,10));
});

router.get('/complaints', requireAdmin, (req, res) => res.json(read(complaintsFile)));
router.put('/complaints/:id/resolve', requireAdmin, (req, res) => {
  const comps = read(complaintsFile);
  const idx = comps.findIndex(c => c.id == req.params.id);
  if (idx !== -1) { comps[idx].status = 'resolved'; comps[idx].resolvedAt = new Date().toISOString(); write(complaintsFile, comps); res.json({ success: true }); }
  else res.status(404).json({ error: 'Not found' });
});
router.post('/vendors/:id/block', requireAdmin, (req, res) => {
  const users = read(usersFile);
  const vendor = users.find(u => u.id == req.params.id && u.role === 'vendor');
  if (vendor) { vendor.status = 'blocked'; write(usersFile, users); res.json({ success: true }); }
  else res.status(404).json({ error: 'Vendor not found' });
});

router.get('/offers', requireAdmin, (req, res) => res.json(read(offersFile)));
router.post('/offers', requireAdmin, (req, res) => {
  const offers = read(offersFile);
  const newOffer = { id: Date.now(), ...req.body, used_count: 0 };
  offers.push(newOffer);
  write(offersFile, offers);
  res.json(newOffer);
});
router.delete('/offers/:id', requireAdmin, (req, res) => {
  let offers = read(offersFile);
  const filtered = offers.filter(o => o.id != req.params.id);
  if (filtered.length === offers.length) return res.status(404).json({ error: 'Not found' });
  write(offersFile, filtered);
  res.json({ success: true });
});

router.get('/revenue/:year', requireAdmin, (req, res) => {
  const payments = read(paymentsFile);
  const months = Array(12).fill(0);
  payments.forEach(p => {
    const date = new Date(p.payment_date);
    if (date.getFullYear() == req.params.year) months[date.getMonth()] += p.amount;
  });
  res.json(months);
});


// MongoDB Admin User Management
router.get('/mongo-users', requireAdmin, async (req, res) => {
  try {
    const filter = {};

    if (req.query.role) filter.businessRole = req.query.role;
    if (req.query.city) filter.city = new RegExp(req.query.city, 'i');
    if (req.query.state) filter.state = new RegExp(req.query.state, 'i');
    if (req.query.pincode) filter.pincode = String(req.query.pincode);

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/mongo-users/:id/admin-control', requireAdmin, async (req, res) => {
  try {
    const allowed = [
      'isActive',
      'isMarketplaceVisible',
      'isVerified',
      'blockedReason'
    ];

    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/mongo-users/:id/block', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isActive: false,
        isMarketplaceVisible: false,
        blockedReason: req.body.blockedReason || 'Blocked by admin'
      },
      { new: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/mongo-users/:id/unblock', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isActive: true,
        blockedReason: ''
      },
      { new: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

