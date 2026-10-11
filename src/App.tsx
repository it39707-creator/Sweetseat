import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Heart, Sparkles, CheckCircle2 } from 'lucide-react';

// ดึงค่า URL และ Key อัตโนมัติจาก Vercel Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [objects, setObjects] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [userName, setUserName] = useState('');
  const [selectedSeat, setSelectedSeat] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;

    fetchRoomData(selectedRoom.id);

    // ระบบ Realtime อัปเดตผังที่นั่งสดๆ
    const channel = supabase
      .channel('realtime-reservations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `room_id=eq.${selectedRoom.id}` },
        () => fetchRoomData(selectedRoom.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom]);

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*');
    if (data) setRooms(data);
  };

  const fetchRoomData = async (roomId: string) => {
    const { data: objs } = await supabase.from('room_objects').select('*').eq('room_id', roomId);
    const { data: resv } = await supabase.from('reservations').select('*').eq('room_id', roomId).eq('status', 'confirmed');
    if (objs) setObjects(objs);
    if (resv) setReservations(resv);
  };

  const handleBook = async () => {
    if (!userName.trim()) {
      alert('กรุณากรอกชื่อของคุณก่อนจองนะครับ 🌸');
      return;
    }
    if (!selectedSeat || !selectedRoom) return;

    setLoading(true);
    setMessage('');

    const { data, error } = await supabase.rpc('book_seat', {
      p_room_id: selectedRoom.id,
      p_seat_object_id: selectedSeat.id,
      p_user_identifier: userName
    });

    setLoading(false);

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } else if (data && !data.success) {
      alert(data.message);
    } else {
      setMessage('🎉 จองที่นั่งสำเร็จแล้วค่ะ!');
      setSelectedSeat(null);
      fetchRoomData(selectedRoom.id);
    }
  };

  const isSeatTaken = (seatId: string) => {
    return reservations.some(r => r.seat_object_id === seatId);
  };

  const getOccupantName = (seatId: string) => {
    const res = reservations.find(r => r.seat_object_id === seatId);
    return res ? res.user_identifier : '';
  };

  return (
    <div className="min-h-screen bg-pink-50 text-gray-700 font-sans pb-10">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-sm border-b border-pink-100 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-pink-400 text-white p-2 rounded-2xl shadow-md">
              <Heart className="w-6 h-6 fill-current" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-green-400 bg-clip-text text-transparent">
              Sweet Seat 🌸
            </h1>
          </div>
          {selectedRoom && (
            <button
              onClick={() => setSelectedRoom(null)}
              className="text-xs bg-pink-100 text-pink-500 px-3 py-1.5 rounded-full hover:bg-pink-200 transition"
            >
              ← กลับไปเลือกห้อง
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-4">
        {!selectedRoom ? (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-center text-gray-600 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" /> เลือกห้องที่ต้องการจอง
            </h2>
            {rooms.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-3xl shadow-sm border border-pink-100">
                <p className="text-gray-400">ยังไม่มีห้องที่เปิดให้จองในขณะนี้ 🎀</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className="bg-white p-5 rounded-3xl border border-pink-100 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold px-2.5 py-1 bg-green-100 text-green-600 rounded-full">
                        {room.status?.toUpperCase() || 'OPEN'}
                      </span>
                      <h3 className="text-lg font-bold mt-2 text-gray-800">{room.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{room.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-50 text-xs text-gray-400 flex justify-between">
                      <span>รหัสห้อง: {room.room_code}</span>
                      <span className="text-pink-400 font-medium">กดเพื่อเข้าจอง →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-3xl border border-pink-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedRoom.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedRoom.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อของคุณ..."
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  className="px-4 py-2 border border-pink-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
            </div>

            {message && (
              <div className="p-3 bg-green-100 text-green-700 text-sm rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> {message}
              </div>
            )}

            <div className="bg-white p-6 rounded-3xl border border-pink-100 shadow-sm relative min-h-[350px] overflow-auto">
              <div className="text-xs text-gray-400 mb-4 flex gap-4 justify-center">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-200 rounded-md inline-block"></span> ว่าง</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-pink-300 rounded-md inline-block"></span> เลือกอยู่</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-300 rounded-md inline-block"></span> มีคนจองแล้ว</span>
              </div>

              <div className="relative w-full h-[300px] border-2 border-dashed border-pink-100 rounded-2xl bg-pink-50/30">
                {objects.map(obj => {
                  const taken = isSeatTaken(obj.id);
                  const isSelected = selectedSeat?.id === obj.id;
                  const occupant = getOccupantName(obj.id);

                  if (obj.type === 'seat') {
                    return (
                      <button
                        key={obj.id}
                        disabled={taken}
                        onClick={() => setSelectedSeat(obj)}
                        style={{
                          left: `${obj.x}px`,
                          top: `${obj.y}px`,
                          width: `${obj.width}px`,
                          height: `${obj.height}px`
                        }}
                        className={`absolute rounded-2xl flex flex-col items-center justify-center font-bold text-xs transition shadow-sm ${
                          taken
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : isSelected
                            ? 'bg-pink-400 text-white ring-4 ring-pink-200 scale-105'
                            : 'bg-green-200 text-green-800 hover:bg-green-300'
                        }`}
                      >
                        <span>{obj.seat_number || obj.label || 'เก้าอี้'}</span>
                        {taken && (
                          <span className="text-[9px] font-normal truncate max-w-full px-1">{occupant}</span>
                        )}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={obj.id}
                      style={{
                        left: `${obj.x}px`,
                        top: `${obj.y}px`,
                        width: `${obj.width}px`,
                        height: `${obj.height}px`
                      }}
                      className="absolute bg-amber-100 text-amber-800 border border-amber-200 rounded-xl flex items-center justify-center text-xs font-medium"
                    >
                      {obj.label || 'โต๊ะ'}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedSeat && (
              <div className="bg-white p-4 rounded-3xl border border-pink-100 shadow-sm flex justify-between items-center">
                <div>
                  <span className="text-xs text-gray-400">ที่นั่งที่เลือก:</span>
                  <p className="font-bold text-pink-500">{selectedSeat.seat_number || selectedSeat.label}</p>
                </div>
                <button
                  onClick={handleBook}
                  disabled={loading}
                  className="bg-pink-400 text-white font-bold px-6 py-2.5 rounded-2xl shadow-md hover:bg-pink-500 transition disabled:opacity-50"
                >
                  {loading ? 'กำลังบันทึก...' : 'ยืนยันการจอง 🌸'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
