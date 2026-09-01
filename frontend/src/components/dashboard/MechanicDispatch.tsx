import { useCallback, useEffect, useState } from 'react';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';
import type { ConnectionState } from '../../lib/realtime';
import { actOnBooking, listBookings, type Booking, type BookingStatus } from '../../lib/booking';
import { VEHICLE_TYPE_LABELS, getMechanicProfile } from '../../lib/mechanic';
import DispatchMap from './DispatchMap';
import { X, ArrowRight, MapPin } from 'lucide-react';
import { getCurrentPosition, type Coordinates } from '../../lib/discovery';

const BRAND = '#00966B';
const BLUE = '#0063F7';
const ORANGE = '#F59E0B';

export default function MechanicDispatch() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'ongoing' | 'completed'>('new');
  const [mechanicLocation, setMechanicLocation] = useState<Coordinates | null>(null);
  const [mechanicStats, setMechanicStats] = useState<{ total_reviews: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setBookings(await listBookings());
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Could not load booking requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    getMechanicProfile().then(p => {
      setMechanicLocation({ latitude: p.latitude, longitude: p.longitude });
      setMechanicStats({ total_reviews: p.total_reviews });
    }).catch(() => {
      // Fallback if profile not fully setup
      getCurrentPosition().then(setMechanicLocation).catch(() => {});
    });
  }, [load]);

  // Realtime updates
  useBookingRealtime('mechanic', load, setConnection);

  const act = async (id: string, action: 'accept' | 'reject' | 'start' | 'complete') => {
    setBusyId(id);
    try {
      const updated = await actOnBooking(id, action);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Could not update that booking.');
    } finally {
      setBusyId('');
    }
  };

  const pending = bookings.filter((b) => b.status === 'PENDING');
  const ongoing = bookings.filter((b) => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS');
  const completed = bookings.filter((b) => b.status === 'COMPLETED');
  
  const today = new Date();
  const completedToday = completed.filter(b => {
    if (!b.created_at) return false;
    const d = new Date(b.created_at);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  const getFilteredBookings = () => {
    switch (activeTab) {
      case 'new': return pending;
      case 'ongoing': return ongoing;
      case 'completed': return completed;
      default: return bookings;
    }
  };

  const filtered = getFilteredBookings();
  const selectedBooking = bookings.find(b => b.id === selectedId);

  const formatTimeAgo = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const mins = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getStatusColor = (status: BookingStatus) => {
    if (status === 'PENDING') return BRAND;
    if (status === 'COMPLETED') return ORANGE;
    return BLUE;
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#F5F9FD]">
      {/* Map Background */}
      <DispatchMap 
        mechanicLocation={mechanicLocation} 
        bookings={bookings} 
        selectedId={selectedId} 
        onSelect={setSelectedId} 
      />

      {/* Left Panel: My Bookings */}
      <div 
        className="absolute top-[88px] left-6 bottom-6 w-[420px] rounded-[32px] flex flex-col overflow-hidden z-[400]"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(32px) saturate(140%)',
          WebkitBackdropFilter: 'blur(32px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
        }}
      >
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-[#111827]">My Bookings</h2>
          
          <div className="flex gap-2 mt-4 bg-white/50 p-1.5 rounded-2xl border border-white/60">
            {(['All', 'New', 'Ongoing', 'Completed'] as const).map(tab => {
              const val = tab.toLowerCase() as typeof activeTab;
              const isActive = activeTab === val;
              let count = 0;
              if (val === 'new') count = pending.length;
              if (val === 'ongoing') count = ongoing.length;
              
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(val); setSelectedId(null); }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? 'bg-white shadow-sm text-[#111827]' 
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {tab}
                    {count > 0 && (
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white" style={{ background: BRAND }}>
                        {count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          {loading ? (
            <div className="text-sm text-zinc-500 p-4">Loading requests...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-zinc-500 p-4 bg-white/40 rounded-2xl border border-white/50">
              No bookings found in this category.
            </div>
          ) : (
            filtered.map(b => (
              <div 
                key={b.id} 
                onClick={() => setSelectedId(b.id)}
                className={`p-4 rounded-2xl transition-all cursor-pointer border ${
                  selectedId === b.id 
                    ? `bg-white shadow-md` 
                    : 'bg-white/60 shadow-sm hover:bg-white/80'
                }`}
                style={{
                  borderColor: selectedId === b.id ? BRAND : 'rgba(255,255,255,0.8)'
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: getStatusColor(b.status) }}>
                      {b.status === 'PENDING' ? 'NEW REQUEST' : b.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-[#6B7280]">{formatTimeAgo(b.created_at)}</span>
                </div>
                
                <h3 className="text-[#111827] font-semibold">{b.customer.name}</h3>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  {VEHICLE_TYPE_LABELS[b.vehicle_type]} · {b.problem_description}
                </p>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span className="truncate">{b.service_address || 'Address provided'}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}
                    className="flex-1 h-9 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-[#111827] hover:bg-gray-50 transition-colors"
                  >
                    View Details
                  </button>
                  {b.status === 'PENDING' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); void act(b.id, 'accept'); }}
                      disabled={busyId === b.id}
                      className="flex-1 h-9 rounded-xl text-sm font-semibold text-white transition-colors"
                      style={{ background: BRAND }}
                    >
                      {busyId === b.id ? '...' : 'Accept'}
                    </button>
                  )}
                  {b.status === 'ACCEPTED' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); void act(b.id, 'start'); }}
                      disabled={busyId === b.id}
                      className="flex-1 h-9 rounded-xl text-sm font-semibold text-white transition-colors"
                      style={{ background: BLUE }}
                    >
                      {busyId === b.id ? '...' : 'Start'}
                    </button>
                  )}
                  {b.status === 'IN_PROGRESS' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); void act(b.id, 'complete'); }}
                      disabled={busyId === b.id}
                      className="flex-1 h-9 rounded-xl text-sm font-semibold text-white transition-colors"
                      style={{ background: BRAND }}
                    >
                      {busyId === b.id ? '...' : 'Complete'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/40 flex items-center justify-between text-xs text-[#6B7280]">
          Showing {filtered.length} of {bookings.length} bookings
          <span 
            className="flex items-center gap-1 cursor-pointer hover:text-[#111827]"
            onClick={() => setActiveTab('all')}
          >
            View all
          </span>
        </div>
      </div>

      {/* Right Detail Card */}
      {selectedBooking && (
        <div 
          className="absolute right-6 bottom-32 w-[400px] rounded-[28px] overflow-hidden z-[400] animate-in slide-in-from-right-4 fade-in duration-300"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(32px) saturate(140%)',
            WebkitBackdropFilter: 'blur(32px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.12)'
          }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: getStatusColor(selectedBooking.status) }}>
                {selectedBooking.status === 'PENDING' ? 'NEW REQUEST' : selectedBooking.status.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#6B7280]">{formatTimeAgo(selectedBooking.created_at)}</span>
                <button onClick={() => setSelectedId(null)} className="text-[#9CA3AF] hover:text-[#111827]">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-4 items-start mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-lg">
                {selectedBooking.customer.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#111827]">{selectedBooking.customer.name}</h3>
                <p className="text-sm text-[#4B5563] mt-0.5">
                  {VEHICLE_TYPE_LABELS[selectedBooking.vehicle_type]} · {selectedBooking.problem_description}
                </p>
                {selectedBooking.customer.phone_number && (
                  <p className="text-xs text-[#6B7280] mt-1">{selectedBooking.customer.phone_number}</p>
                )}
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3 text-sm text-[#4B5563]">
                <MapPin className="w-5 h-5 text-[#9CA3AF] shrink-0" />
                <span>{selectedBooking.service_address || 'Address provided by customer'}</span>
              </div>
            </div>

            <div className="flex gap-3">
              {selectedBooking.status === 'PENDING' && (
                <>
                  <button 
                    onClick={() => void act(selectedBooking.id, 'reject')}
                    disabled={busyId === selectedBooking.id}
                    className="flex-1 h-12 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-[#111827] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => void act(selectedBooking.id, 'accept')}
                    disabled={busyId === selectedBooking.id}
                    className="flex-[2] h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors hover:brightness-110"
                    style={{ background: BRAND }}
                  >
                    {busyId === selectedBooking.id ? 'Accepting...' : 'Accept Booking'} <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
              {selectedBooking.status === 'ACCEPTED' && (
                <button 
                  onClick={() => void act(selectedBooking.id, 'start')}
                  disabled={busyId === selectedBooking.id}
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors hover:brightness-110"
                  style={{ background: BLUE }}
                >
                  {busyId === selectedBooking.id ? 'Starting...' : 'Start Service'} <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {selectedBooking.status === 'IN_PROGRESS' && (
                <button 
                  onClick={() => void act(selectedBooking.id, 'complete')}
                  disabled={busyId === selectedBooking.id}
                  className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors hover:brightness-110"
                  style={{ background: BRAND }}
                >
                  {busyId === selectedBooking.id ? 'Completing...' : 'Mark Completed'} <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {selectedBooking.status === 'COMPLETED' && (
                <div className="w-full text-center text-sm font-medium text-zinc-500 py-2">
                  This booking has been completed.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Statistics Card */}
      <div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] h-[88px] rounded-[24px] flex items-center px-8 gap-10"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(32px) saturate(140%)',
          WebkitBackdropFilter: 'blur(32px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)'
        }}
      >
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <span className="text-xl font-bold text-[#111827] leading-none">{pending.length}</span>
          <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mt-1">New Requests</span>
        </div>
        
        <div className="w-[1px] h-10 bg-gray-200/50" />
        
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <span className="text-xl font-bold text-[#111827] leading-none">{ongoing.length}</span>
          <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mt-1">Ongoing</span>
        </div>
        
        <div className="w-[1px] h-10 bg-gray-200/50" />
        
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <span className="text-xl font-bold text-[#111827] leading-none">{completedToday.length}</span>
          <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mt-1">Completed Today</span>
        </div>
        
        <div className="w-[1px] h-10 bg-gray-200/50" />
        
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-purple-500 mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <span className="text-xl font-bold text-[#111827] leading-none">{mechanicStats?.total_reviews || 0}</span>
          <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mt-1">Total Reviews</span>
        </div>
      </div>
      
      {/* Realtime Status Indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400]">
         <span
          data-testid="realtime-state"
          data-state={connection}
          title={connection === 'open' ? 'Live updates on' : 'Reconnecting…'}
          className={`inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-white/50 backdrop-blur border border-white/60 shadow-sm ${
            connection === 'open' ? 'text-emerald-600' : 'text-zinc-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${
            connection === 'open' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-zinc-400 animate-pulse'
          }`} />
          {connection === 'open' ? 'System Live' : 'Offline'}
        </span>
      </div>

    </div>
  );
}
