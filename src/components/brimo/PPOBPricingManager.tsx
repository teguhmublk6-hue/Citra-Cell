
"use client";

import { useState, useEffect } from 'react';
import ppobPricingData from '@/lib/ppob-pricing.json';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Plus } from 'lucide-react';

type ServiceType = keyof typeof ppobPricingData;

// This is a stand-in for a proper backend call.
// In a real app, this would be an API call to a server-side function.
async function savePricingData(data: typeof ppobPricingData): Promise<{ success: boolean; message: string }> {
  try {
    // Here, we would make a fetch request to a serverless function
    // For example:
    // const response = await fetch('/api/save-ppob-pricing', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data),
    // });
    // if (!response.ok) throw new Error('Failed to save');
    
    console.log("Simulating save to backend:", data);
    
    // For now, we'll just log to console and return success.
    // The developer would need to replace this with an actual API endpoint
    // that has filesystem write access.
    return { success: true, message: 'Data berhasil disimulasikan untuk disimpan. Implementasi backend diperlukan.' };

  } catch (error) {
    console.error("Error saving pricing data:", error);
    return { success: false, message: 'Gagal menyimpan data.' };
  }
}

const formatToRupiah = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(String(value).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return '';
    return `Rp ${num.toLocaleString('id-ID')}`;
};

const parseRupiah = (value: string | undefined | null): number => {
    if (!value) return 0;
    return Number(String(value).replace(/[^0-9]/g, ''));
}


export default function PPOBPricingManager({ onDone }: { onDone: () => void }) {
  const [pricing, setPricing] = useState(ppobPricingData);
  const [newRows, setNewRows] = useState<Record<string, { denom: string; costPrice: number; sellingPrice: number }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (
    service: ServiceType,
    provider: string, 
    denom: string, 
    field: 'costPrice' | 'sellingPrice',
    value?: string
  ) => {
    const numericValue = parseRupiah(value);
    setPricing(prev => {
        const newPricing = JSON.parse(JSON.stringify(prev)); // Deep copy
        if (service === 'Token Listrik') {
            (newPricing[service] as any)[denom][field] = numericValue;
        } else {
            (newPricing[service] as any)[provider][denom][field] = numericValue;
        }
        return newPricing;
    });
  };

  const handleNewRowChange = (key: string, field: keyof typeof newRows[string], value: string) => {
    setNewRows(prev => ({
        ...prev,
        [key]: {
            ...prev[key],
            [field]: (field === 'denom') ? value : parseRupiah(value)
        }
    }));
  };

  const handleAddRow = (service: ServiceType, provider?: string) => {
    const key = provider ? `${service}-${provider}` : service;
    setNewRows(prev => ({
        ...prev,
        [key]: { denom: '', costPrice: 0, sellingPrice: 0 }
    }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    toast({ title: 'Menyimpan...', description: 'Perubahan Anda sedang diproses.' });

    let updatedPricing = JSON.parse(JSON.stringify(pricing));

    for (const key in newRows) {
        const { denom, costPrice, sellingPrice } = newRows[key];
        if (denom && (costPrice > 0 || sellingPrice > 0)) {
            const parts = key.split('-');
            const service = parts[0] as ServiceType;

            if (service === 'Token Listrik') {
                if (!updatedPricing[service]) updatedPricing[service] = {};
                (updatedPricing[service] as any)[denom] = { costPrice, sellingPrice };
            } else {
                const provider = parts[1];
                if (!updatedPricing[service]) updatedPricing[service] = {};
                if (!(updatedPricing[service] as any)[provider]) (updatedPricing[service] as any)[provider] = {};
                (updatedPricing[service] as any)[provider][denom] = { costPrice, sellingPrice };
            }
        }
    }
    
    // In a real application, you would make an API call here.
    console.log("Perubahan ini perlu disimpan ke `src/lib/ppob-pricing.json`. Karena keterbatasan lingkungan, saya tidak bisa menulis file secara langsung. Terapkan perubahan ini secara manual atau buat endpoint API untuk menanganinya.", updatedPricing);
    
    toast({
        title: 'Simulasi Berhasil',
        description: 'Perubahan telah dicatat di log. Perlu implementasi backend untuk menyimpan file.',
        duration: 5000,
    });

    setIsSaving(false);
    onDone();
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-4 pt-4 pb-6">
            <p className="text-sm text-muted-foreground">
                Atur harga modal dan harga jual untuk setiap produk PPOB. Perubahan akan langsung memengaruhi form transaksi.
            </p>
            <Accordion type="multiple" className="w-full" defaultValue={['Pulsa', 'Token Listrik', 'Paket Data']}>
              {(Object.keys(pricing) as ServiceType[]).map((serviceName) => (
                <AccordionItem value={serviceName} key={serviceName}>
                    <AccordionTrigger>{serviceName}</AccordionTrigger>
                    <AccordionContent>
                      {serviceName === 'Token Listrik' ? (
                        <>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead className="text-right w-[30%]">Denom</TableHead>
                                <TableHead className="text-right w-[35%]">Harga Modal</TableHead>
                                <TableHead className="text-right w-[35%]">Harga Jual</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(pricing[serviceName] as any).map(([denom, prices]) => (
                                <TableRow key={denom}>
                                    <TableCell className="font-medium text-right">{denom}</TableCell>
                                    <TableCell>
                                    <Input
                                        type="text"
                                        value={formatToRupiah((prices as any).costPrice)}
                                        onChange={(e) => handleInputChange(serviceName, '', denom, 'costPrice', e.target.value)}
                                        className="h-9 text-xs text-right"
                                    />
                                    </TableCell>
                                    <TableCell>
                                    <Input
                                        type="text"
                                        value={formatToRupiah((prices as any).sellingPrice)}
                                        onChange={(e) => handleInputChange(serviceName, '', denom, 'sellingPrice', e.target.value)}
                                        className="h-9 text-xs text-right"
                                    />
                                    </TableCell>
                                </TableRow>
                                ))}
                                {newRows[serviceName] && (
                                    <TableRow>
                                        <TableCell><Input placeholder="20000" className="h-9 text-xs text-right" value={newRows[serviceName].denom} onChange={(e) => handleNewRowChange(serviceName, 'denom', e.target.value)} /></TableCell>
                                        <TableCell><Input placeholder="0" className="h-9 text-xs text-right" value={formatToRupiah(newRows[serviceName].costPrice)} onChange={(e) => handleNewRowChange(serviceName, 'costPrice', e.target.value)} /></TableCell>
                                        <TableCell><Input placeholder="0" className="h-9 text-xs text-right" value={formatToRupiah(newRows[serviceName].sellingPrice)} onChange={(e) => handleNewRowChange(serviceName, 'sellingPrice', e.target.value)} /></TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        <div className="mt-2">
                            <Button variant="outline" size="sm" onClick={() => handleAddRow(serviceName)} disabled={!!newRows[serviceName]}>
                                <Plus className="mr-2 h-4 w-4" /> Tambah Denom
                            </Button>
                        </div>
                        </>
                      ) : (
                        <Accordion type="multiple" className="w-full pl-4" defaultValue={Object.keys(pricing[serviceName] as object)[0] ? `${serviceName}-${Object.keys(pricing[serviceName] as object)[0]}` : undefined}>
                            {Object.entries(pricing[serviceName] as any).map(([providerName, providerData]) => (
                            <AccordionItem value={`${serviceName}-${providerName}`} key={`${serviceName}-${providerName}`}>
                                <AccordionTrigger>{providerName}</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                            <TableHead className="w-[30%]">Denom/Paket</TableHead>
                                            <TableHead className="text-right w-[35%]">Harga Modal</TableHead>
                                            <TableHead className="text-right w-[35%]">Harga Jual</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Object.entries(providerData as any).map(([denom, prices]) => (
                                            <TableRow key={denom}>
                                                <TableCell className="font-medium text-xs truncate">{denom}</TableCell>
                                                <TableCell>
                                                <Input
                                                    type="text"
                                                    value={formatToRupiah((prices as any).costPrice)}
                                                    onChange={(e) => handleInputChange(serviceName, providerName, denom, 'costPrice', e.target.value)}
                                                    className="h-9 text-xs text-right"
                                                />
                                                </TableCell>
                                                <TableCell>
                                                <Input
                                                    type="text"
                                                    value={formatToRupiah((prices as any).sellingPrice)}
                                                    onChange={(e) => handleInputChange(serviceName, providerName, denom, 'sellingPrice', e.target.value)}
                                                    className="h-9 text-xs text-right"
                                                />
                                                </TableCell>
                                            </TableRow>
                                            ))}
                                            {newRows[`${serviceName}-${providerName}`] && (
                                                <TableRow>
                                                    <TableCell><Input placeholder="Nama Paket" className="h-9 text-xs" value={newRows[`${serviceName}-${providerName}`].denom} onChange={(e) => handleNewRowChange(`${serviceName}-${providerName}`, 'denom', e.target.value)} /></TableCell>
                                                    <TableCell><Input placeholder="0" className="h-9 text-xs text-right" value={formatToRupiah(newRows[`${serviceName}-${providerName}`].costPrice)} onChange={(e) => handleNewRowChange(`${serviceName}-${providerName}`, 'costPrice', e.target.value)} /></TableCell>
                                                    <TableCell><Input placeholder="0" className="h-9 text-xs text-right" value={formatToRupiah(newRows[`${serviceName}-${providerName}`].sellingPrice)} onChange={(e) => handleNewRowChange(`${serviceName}-${providerName}`, 'sellingPrice', e.target.value)} /></TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                    <div className="mt-2">
                                        <Button variant="outline" size="sm" onClick={() => handleAddRow(serviceName, providerName)} disabled={!!newRows[`${serviceName}-${providerName}`]}>
                                            <Plus className="mr-2 h-4 w-4" /> Tambah Paket
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            ))}
                        </Accordion>
                      )}
                    </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
        </div>
      </ScrollArea>
      <div className="flex gap-2 pt-4 pb-4 border-t border-border -mx-6 px-6">
        <Button type="button" variant="outline" onClick={onDone} className="w-full" disabled={isSaving}>
          Batal
        </Button>
        <Button type="button" onClick={handleSaveChanges} className="w-full" disabled={isSaving}>
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </Button>
      </div>
    </div>
  );
}

    