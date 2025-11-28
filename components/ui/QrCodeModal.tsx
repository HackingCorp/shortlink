'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

type QrCodeModalProps = {
  shortCode: string;
  onClose: () => void;
};

export function QrCodeModal({ shortCode, onClose }: QrCodeModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/v1/links/${shortCode}/qr`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setQrCodeUrl(data.data.qr_code_data_url);
        }
      })
      .finally(() => setIsLoading(false));
  }, [shortCode]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
          <X />
        </button>
        <h2 className="text-2xl font-bold text-center">QR Code</h2>
        <p className="text-center text-sm text-gray-500 mt-2 font-mono">{`shorty.fr/${shortCode}`}</p>
        <div className="mt-6 aspect-square w-full flex items-center justify-center">
          {isLoading ? (
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          ) : (
            <img src={qrCodeUrl} alt={`QR Code for ${shortCode}`} className="rounded-md" />
          )}
        </div>
        <a href={qrCodeUrl} download={`qrcode-${shortCode}.png`} className="mt-6 w-full block text-center py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
            Télécharger
        </a>
      </div>
    </div>
  );
}