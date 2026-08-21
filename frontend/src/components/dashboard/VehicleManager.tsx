import { useState, useEffect } from 'react';
import { Car, Plus, Star, Trash, PencilSimple } from '@phosphor-icons/react';
import gsap from 'gsap';
import VehicleModal from './VehicleModal';
import SpecularButton from '../ui/SpecularButton';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  is_default: boolean;
}

export default function VehicleManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: '1',
      make: 'Tesla',
      model: 'Model 3',
      year: 2023,
      color: 'Pearl White',
      license_plate: 'ABC-1234',
      is_default: true,
    },
    {
      id: '2',
      make: 'Toyota',
      model: 'Tacoma',
      year: 2019,
      color: 'Quicksand',
      license_plate: 'XYZ-9876',
      is_default: false,
    }
  ]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    gsap.fromTo('.vehicle-card', 
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.1 }
    );
  }, [vehicles.length]);

  const handleAdd = () => {
    setEditingVehicle(null);
    setIsModalOpen(true);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  const handleSetDefault = (id: string) => {
    setVehicles(prev => prev.map(v => ({
      ...v,
      is_default: v.id === id
    })));
  };

  const handleSave = (vehicleData: Partial<Vehicle>) => {
    if (editingVehicle) {
      setVehicles(prev => prev.map(v => v.id === editingVehicle.id ? { ...v, ...vehicleData } as Vehicle : v));
    } else {
      setVehicles(prev => [
        ...prev, 
        { 
          ...vehicleData, 
          id: Math.random().toString(), 
          is_default: prev.length === 0 // default if first
        } as Vehicle
      ]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.5)] profile-anim">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-white tracking-tight">My Vehicles</h2>
            <p className="text-zinc-400 text-sm mt-1">Manage the vehicles associated with your account.</p>
          </div>
          
          <SpecularButton
            onClick={handleAdd}
            className="h-11 px-6"
            tint="#10b981"
            tintOpacity={1}
            textColor="#ffffff"
            lineColor="#a7f3d0"
            baseColor="#047857"
            radius={16}
          >
            <div className="flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              Add Vehicle
            </div>
          </SpecularButton>
        </div>

        {vehicles.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-[24px] bg-white/[0.01]">
            <Car className="w-12 h-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No vehicles found</h3>
            <p className="text-zinc-400 text-sm max-w-sm">You haven't added any vehicles yet. Add a vehicle to get roadside assistance faster.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.map(vehicle => (
              <div key={vehicle.id} className="vehicle-card group relative bg-white/[0.03] border border-white/10 rounded-[24px] p-6 hover:border-emerald-500/30 hover:bg-white/[0.05] transition-all">
                
                {vehicle.is_default && (
                  <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                    <Star weight="fill" className="w-3 h-3" /> Default
                  </div>
                )}
                
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-400 shrink-0 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                    <Car weight="duotone" className="w-6 h-6" />
                  </div>
                  <div className="pr-16">
                    <h3 className="text-lg font-semibold text-white tracking-tight">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                    <p className="text-zinc-400 text-sm">{vehicle.color} • {vehicle.license_plate}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-white/5 opacity-60 group-hover:opacity-100 transition-opacity">
                  {!vehicle.is_default && (
                    <button 
                      onClick={() => handleSetDefault(vehicle.id)}
                      className="flex-1 py-2 text-xs font-semibold text-zinc-300 bg-white/[0.03] hover:bg-white/10 rounded-xl transition-colors"
                    >
                      Make Default
                    </button>
                  )}
                  <button 
                    onClick={() => handleEdit(vehicle)}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-300 bg-white/[0.03] hover:bg-white/10 rounded-xl transition-colors flex justify-center items-center gap-1"
                  >
                    <PencilSimple className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(vehicle.id)}
                    className="flex-1 py-2 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors flex justify-center items-center gap-1"
                  >
                    <Trash className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <VehicleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave}
        initialData={editingVehicle}
      />
    </div>
  );
}
