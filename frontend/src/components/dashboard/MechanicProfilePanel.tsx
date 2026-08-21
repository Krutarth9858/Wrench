import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import {
  getAvailability,
  getMechanicProfile,
  saveMechanicProfile,
  setAvailability,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  type MechanicProfileInput,
  type VehicleType,
} from '../../lib/mechanic';

const EMPTY: MechanicProfileInput = {
  garage_name: '',
  owner_name: '',
  experience_years: 0,
  bio: '',
  specialization: '',
  supported_vehicle_types: ['CAR'],
  address: '',
  city: '',
  state: '',
  country: '',
  latitude: 0,
  longitude: 0,
  service_radius_km: 10,
  working_start_time: '09:00',
  working_end_time: '18:00',
};

const FIELD =
  'w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500';

export default function MechanicProfilePanel() {
  const [form, setForm] = useState<MechanicProfileInput>(EMPTY);
  const [available, setAvailable] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Availability comes from its own endpoint so the switch has a single source
      // of truth, rather than being inferred from whatever the profile last returned.
      const [profile, availability] = await Promise.all([
        getMechanicProfile(),
        getAvailability(),
      ]);
      const { id, user_id, is_available, is_verified, average_rating, total_reviews,
        completed_jobs, ...editable } = profile;
      void id; void user_id; void is_available; void is_verified; void average_rating;
      void total_reviews; void completed_jobs;
      setForm(editable);
      setAvailable(availability.is_available);
      setHasProfile(true);
    } catch (err) {
      // 404 simply means this mechanic has not set up a profile yet.
      if (err instanceof ApiError && err.status === 404) {
        setHasProfile(false);
      } else {
        setError(err instanceof Error ? err.message : 'Could not load your profile.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof MechanicProfileInput>(key: K, value: MechanicProfileInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleVehicleType = (type: VehicleType) =>
    setForm((prev) => {
      const has = prev.supported_vehicle_types.includes(type);
      // At least one type is required by the backend; refuse to empty the list.
      if (has && prev.supported_vehicle_types.length === 1) return prev;
      return {
        ...prev,
        supported_vehicle_types: has
          ? prev.supported_vehicle_types.filter((t) => t !== type)
          : [...prev.supported_vehicle_types, type],
      };
    });

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveMechanicProfile(form);
      setAvailable(saved.is_available);
      setHasProfile(true);
      setNotice('Profile saved.');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvailability = async () => {
    const next = !available;
    setTogglingAvailability(true);
    setError('');
    try {
      const result = await setAvailability(next);
      setAvailable(result.is_available); // trust the backend, not the optimistic value
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update availability.');
    } finally {
      setTogglingAvailability(false);
    }
  };

  if (loading) {
    return (
      <div
        data-testid="mechanic-panel-loading"
        className="bg-[#18181B] rounded-[40px] p-8 border border-white/5 text-zinc-500 text-sm"
      >
        Loading your profile…
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
        Mechanic Profile
      </span>
      <h2 className="text-2xl font-semibold text-white tracking-tight">Garage settings</h2>
      <p className="text-zinc-400 text-sm mt-1 mb-8">
        {hasProfile
          ? 'Update your garage details, coverage and availability.'
          : 'Set up your garage profile so customers can find you.'}
      </p>

      {/* Availability */}
      <div className="mb-8 flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div>
          <div className="flex items-center gap-2">
            <span
              data-testid="availability-dot"
              className={`w-2 h-2 rounded-full ${available ? 'bg-emerald-400' : 'bg-zinc-500'}`}
            />
            <span data-testid="availability-label" className="text-white font-medium">
              {available ? 'Available' : 'Unavailable'}
            </span>
          </div>
          <p className="text-zinc-500 text-sm font-light mt-1">
            {hasProfile
              ? 'Customers can only be matched with you while you are available.'
              : 'Save your profile first to control availability.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={available}
          aria-label="Toggle availability"
          data-testid="availability-toggle"
          disabled={!hasProfile || togglingAvailability}
          onClick={handleAvailability}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            available ? 'bg-emerald-500' : 'bg-white/10'
          }`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${
              available ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {error && (
        <div
          data-testid="mechanic-error"
          role="alert"
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          data-testid="mechanic-notice"
          className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm"
        >
          {notice}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="space-y-2 block">
            <span className={LABEL}>Garage name</span>
            <input name="garage_name" required value={form.garage_name}
              onChange={(e) => update('garage_name', e.target.value)} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>Owner name</span>
            <input name="owner_name" required value={form.owner_name}
              onChange={(e) => update('owner_name', e.target.value)} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>Specialization</span>
            <input name="specialization" required value={form.specialization}
              onChange={(e) => update('specialization', e.target.value)} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>Experience (years)</span>
            <input name="experience_years" type="number" min={0} required
              value={form.experience_years}
              onChange={(e) => update('experience_years', Number(e.target.value))} className={FIELD} />
          </label>
        </div>

        <div className="space-y-2">
          <span className={LABEL}>Supported vehicles</span>
          <div className="grid grid-cols-2 gap-3">
            {VEHICLE_TYPES.map((type) => {
              const selected = form.supported_vehicle_types.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  data-testid={`vehicle-${type}`}
                  onClick={() => toggleVehicleType(type)}
                  className={`h-11 rounded-2xl border text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {VEHICLE_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
          <p className="text-zinc-600 text-xs">
            Wrench covers two- and four-wheelers only.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="space-y-2 block">
            <span className={LABEL}>Service radius (km)</span>
            <input name="service_radius_km" type="number" step="0.5" min={0.5} required
              value={form.service_radius_km}
              onChange={(e) => update('service_radius_km', Number(e.target.value))} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>Opens</span>
            <input name="working_start_time" type="time" required value={form.working_start_time}
              onChange={(e) => update('working_start_time', e.target.value)} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>Closes</span>
            <input name="working_end_time" type="time" required value={form.working_end_time}
              onChange={(e) => update('working_end_time', e.target.value)} className={FIELD} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="space-y-2 block md:col-span-2">
            <span className={LABEL}>Address</span>
            <input name="address" required value={form.address}
              onChange={(e) => update('address', e.target.value)} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>City</span>
            <input name="city" required value={form.city}
              onChange={(e) => update('city', e.target.value)} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>State</span>
            <input name="state" required value={form.state}
              onChange={(e) => update('state', e.target.value)} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>Country</span>
            <input name="country" required value={form.country}
              onChange={(e) => update('country', e.target.value)} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>Latitude</span>
            <input name="latitude" type="number" step="any" min={-90} max={90} required
              value={form.latitude}
              onChange={(e) => update('latitude', Number(e.target.value))} className={FIELD} />
          </label>
          <label className="space-y-2 block">
            <span className={LABEL}>Longitude</span>
            <input name="longitude" type="number" step="any" min={-180} max={180} required
              value={form.longitude}
              onChange={(e) => update('longitude', Number(e.target.value))} className={FIELD} />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          data-testid="save-profile"
          className="h-12 px-8 rounded-2xl bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
