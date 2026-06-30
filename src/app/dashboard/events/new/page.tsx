'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';

const CATEGORIES = [
  { value: 'marathon', label: 'Marathon' },
  { value: 'concert', label: 'Concert' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
];

export default function CreateEventPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'marathon',
    locationName: '',
    eventDate: '',
    pricePerPhoto: 15000,
    tags: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          location: { name: form.locationName },
          eventDate: new Date(form.eventDate).toISOString(),
          pricePerPhoto: Number(form.pricePerPhoto),
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      router.push(`/dashboard/events/${data.event.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl bg-neutral-900/30 border border-neutral-900 p-5 sm:p-8 rounded-3xl shadow-xl animate-fadeIn space-y-6">
      
      {/* Back to list */}
      <button 
        onClick={() => router.back()} 
        className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-50 transition duration-200"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Kembali
      </button>

      <div>
        <h1 className="text-2xl font-extrabold text-neutral-50">Create New Event</h1>
        <p className="text-xs text-neutral-400 mt-1 font-light">Set up your event details. You can upload photos after creating the event.</p>
        <div className="bg-blue-500/5 border border-blue-500/20 text-blue-200 p-3 rounded-xl text-xs mt-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="font-light leading-relaxed">
            Event akan dibuat dalam mode <strong>Draft</strong>. Setelah mengupload foto, klik tombol <strong>&quot;Publish&quot;</strong> untuk membuat event terlihat oleh publik.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-error-bg border border-error-border text-error-text p-4 rounded-xl text-sm mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="event-title" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Event Title</label>
          <input
            id="event-title"
            name="title"
            type="text"
            className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
            placeholder="e.g., Jakarta Marathon 2026"
            value={form.title}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="event-description" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Description</label>
          <textarea
            id="event-description"
            name="description"
            rows={4}
            className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200 resize-none font-light"
            placeholder="Describe your event..."
            value={form.description}
            onChange={handleChange}
            required
            minLength={10}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="event-category" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Category</label>
            <SearchableSelect
              options={CATEGORIES}
              value={form.category}
              onChange={(value) => setForm({ ...form, category: value })}
            />
          </div>

          <div>
            <label htmlFor="event-date" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Event Date</label>
            <input
              id="event-date"
              name="eventDate"
              type="date"
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              value={form.eventDate}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="event-location" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Location</label>
            <input
              id="event-location"
              name="locationName"
              type="text"
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              placeholder="e.g., GBK Senayan, Jakarta"
              value={form.locationName}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label htmlFor="event-price" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Price per Photo (IDR)</label>
            <input
              id="event-price"
              name="pricePerPhoto"
              type="number"
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              placeholder="15000"
              value={form.pricePerPhoto}
              onChange={handleChange}
              required
              min={0}
            />
            <p className="text-[10px] text-neutral-500 mt-1.5 font-light">* Isi dengan angka 0 (nol) jika foto dapat diunduh secara gratis (Free Download).</p>
          </div>
        </div>

        <div>
          <label htmlFor="event-tags" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Tags (comma separated)</label>
          <input
            id="event-tags"
            name="tags"
            type="text"
            className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
            placeholder="running, sports, outdoor"
            value={form.tags}
            onChange={handleChange}
          />
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            className="btn btn-ghost rounded-xl"
            onClick={() => router.back()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary rounded-xl px-6 shadow-lg shadow-primary-500/20 text-sm font-semibold flex items-center justify-center gap-1.5"
            disabled={isLoading}
            id="create-event-submit"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
