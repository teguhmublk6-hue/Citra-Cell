
"use client";

import { useState, useEffect } from 'react';
import ppobPricingData from '@/lib/ppob-pricing.json';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

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
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (
    service: keyof typeof pricing,
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

  const handleSaveChanges = async () => {
    setIsSaving(true);
    toast({ title: 'Menyimpan...', description: 'Perubahan Anda sedang diproses.' });
    
    // In a real application, you would make an API call here to a server-side
    // function that has permission to write to the filesystem.
    // For this example, we will just log a message.
    console.log("Perubahan ini perlu disimpan ke `src/lib/ppob-pricing.json`. Karena keterbatasan lingkungan, saya tidak bisa menulis file secara langsung. Terapkan perubahan ini secara manual atau buat endpoint API untuk menanganinya.");
    
    toast({
        title: 'Simulasi Berhasil',
        description: 'Perubahan telah dicatat di log. Perlu implementasi backend untuk menyimpan file.',
        duration: 5000,
    });

    setIsSaving(false);
    onDone(); // Close the sheet after "saving"
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-4 pt-4 pb-6">
            <p className="text-sm text-muted-foreground">
                Atur harga modal dan harga jual untuk setiap produk PPOB. Perubahan akan langsung memengaruhi form transaksi.
            </p>
            <Accordion type="multiple" className="w-full" defaultValue={['Pulsa', 'Token Listrik', 'Paket Data']}>
              {Object.entries(pricing).map(([serviceName, serviceData]) => (
                <AccordionItem value={serviceName} key={serviceName}>
                    <AccordionTrigger>{serviceName}</AccordionTrigger>
                    <AccordionContent>
                      {serviceName === 'Token Listrik' ? (
                         <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead className="w-[30%]">Denom</TableHead>
                                <TableHead className="text-right w-[35%]">Harga Modal</TableHead>
                                <TableHead className="text-right w-[35%]">Harga Jual</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(serviceData as any).map(([denom, prices]) => (
                                <TableRow key={denom}>
                                    <TableCell className="font-medium">{denom}</TableCell>
                                    <TableCell>
                                    <Input
                                        type="text"
                                        value={formatToRupiah((prices as any).costPrice)}
                                        onChange={(e) => handleInputChange(serviceName as keyof typeof pricing, '', denom, 'costPrice', e.target.value)}
                                        className="h-9 text-right text-xs"
                                    />
                                    </TableCell>
                                    <TableCell>
                                    <Input
                                        type="text"
                                        value={formatToRupiah((prices as any).sellingPrice)}
                                        onChange={(e) => handleInputChange(serviceName as keyof typeof pricing, '', denom, 'sellingPrice', e.target.value)}
                                        className="h-9 text-right text-xs"
                                    />
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                      ) : (
                        <Accordion type="multiple" className="w-full pl-4" defaultValue={Object.keys(serviceData as object)[0]}>
                            {Object.entries(serviceData as any).map(([providerName, providerData]) => (
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
                                                    onChange={(e) => handleInputChange(serviceName as keyof typeof pricing, providerName, denom, 'costPrice', e.target.value)}
                                                    className="h-9 text-right text-xs"
                                                />
                                                </TableCell>
                                                <TableCell>
                                                <Input
                                                    type="text"
                                                    value={formatToRupiah((prices as any).sellingPrice)}
                                                    onChange={(e) => handleInputChange(serviceName as keyof typeof pricing, providerName, denom, 'sellingPrice', e.target.value)}
                                                    className="h-9 text-right text-xs"
                                                />
                                                </TableCell>
                                            </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
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
