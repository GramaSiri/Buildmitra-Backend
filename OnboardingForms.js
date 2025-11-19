import { useState } from 'react';
import axios from 'axios';

export default function OnboardingForm({ phone }) {
  const [form, setForm] = useState({
    vendorName: '',
    tradeType: '',
    materials: '',
    ratePerUnit: '',
    servicePincodes: '',
    imageUrl: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/vendor/onboard', { phone, ...form });
      alert('✅ Vendor profile saved');
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('❌ Onboarding error:', err.message);
      alert('Failed to save vendor profile');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Vendor Onboarding</h2>
      <input name="vendorName" placeholder="Vendor Name" onChange={handleChange} required />
      <input name="tradeType" placeholder="Trade Type" onChange={handleChange} required />
      <input name="materials" placeholder="Materials" onChange={handleChange} />
      <input name="ratePerUnit" placeholder="Rate per Unit" onChange={handleChange} />
      <input name="servicePincodes" placeholder="Service Pincodes" onChange={handleChange} />
      <input name="imageUrl" placeholder="Image URL" onChange={handleChange} />
      <button type="submit">Submit</button>
    </form>
  );
}