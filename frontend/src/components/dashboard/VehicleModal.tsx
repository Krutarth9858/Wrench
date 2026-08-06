import React, { useState, useEffect } from 'react';
import { X, SpinnerGap, Car } from '@phosphor-icons/react';
import { Vehicle } from './VehicleManager';
import SpecularButton from '../ui/SpecularButton';
import gsap from 'gsap';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Vehicle>) => void;
  initialData: Vehicle | null;
}

export default function VehicleModal({ isOpen, onClose, onSave, initialData }: VehicleModalProps) {
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    license_plate: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          make: initialData.make,
          model: initialData.model,
          year: initialData.year,
          color: initialData.color,
          license_plate: initialData.license_plate,
        });
      } else {
        setFormData({
          make: '',
          model: '',
          year: new Date().getFullYear(),
          color: '',
          license_plate: '',
        });
      }
      
      gsap.fromTo('.modal-content', 
        { y: 50, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' }
      );
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // MOCK API DELAY
    await new Promise(r => setTimeout(r, 800));
    
    onSave(formData);
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="modal-content relative w-full max-w-md bg-zinc-950/80 backdrop-blur-[40px] rounded-[32px] p-8 border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Car weight="duotone" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {initialData ? 'Edit Vehicle' : 'Add Vehicle'}
            </h2>
            <p className="text-zinc-400 text-sm">
              {initialData ? 'Update your vehicle details' : 'Register a new vehicle to your profile'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Make</label>
              <input
                type="text"
                name="make"
                value={formData.make}
                onChange={handleChange}
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                placeholder="e.g. Tesla"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Model</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                placeholder="e.g. Model 3"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Year</label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Color</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                placeholder="e.g. White"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">License Plate</label>
            <input
              type="text"
              name="license_plate"
              value={formData.license_plate}
              onChange={handleChange}
              required
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all uppercase"
              placeholder="ABC-1234"
            />
          </div>

          <div className="pt-6">
            <SpecularButton
              type="submit"
              disabled={loading}
              className="w-full h-12"
              tint="#10b981"
              tintOpacity={1}
              textColor="#ffffff"
              lineColor="#a7f3d0"
              baseColor="#047857"
              radius={16}
            >
              <div className="flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <SpinnerGap className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Vehicle'
                )}
              </div>
            </SpecularButton>
          </div>
        </form>

      </div>
    </div>
  );
}
