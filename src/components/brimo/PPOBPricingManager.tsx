
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Plus, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { produce } from 'immer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Card, CardContent } from '../ui/card';

type PriceObject = { costPrice: number; sellingPrice: number; };
type ProviderPricing = Record<string, PriceObject>;
type ServicePricing = Record<string, ProviderPricing | PriceObject>;
type FullPricingData = Record<string, ServicePricing>;


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
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [localPricing, setLocalPricing] = useState<FullPricingData | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const pricingDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'appConfig', 'ppobPricing');
  }, [firestore]);

  const { data: remotePricingData, isLoading } = useDoc<{ data: FullPricingData }>(pricingDocRef);

  useEffect(() => {
    if (remotePricingData) {
      setLocalPricing(remotePricingData.data);
    }
  }, [remotePricingData]);

  const handleInputChange = (path: (string | number)[], field: 'costPrice' | 'sellingPrice', value: string) => {
    setLocalPricing(
      produce(draft => {
        if (!draft) return;
        let current: any = draft;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]];
        }
        current[path[path.length - 1]][field] = parseRupiah(value);
      })
    );
  };
  
  const handleDenomChange = (path: (string | number)[], oldDenom: string, newDenom: string) => {
    if (!newDenom || oldDenom === newDenom) return;
    setLocalPricing(
        produce(draft => {
            if (!draft) return;
            let parent: any = draft;
            for (let i = 0; i < path.length; i++) {
                parent = parent[path[i]];
            }
            if (parent[newDenom] === undefined) { // Prevent overwriting existing denom
              const value = parent[oldDenom];
              delete parent[oldDenom];
              parent[newDenom] = value;
            } else {
              toast({ variant: 'destructive', title: 'Error', description: 'Denominasi tersebut sudah ada.'})
            }
        })
    );
  };

  const handleAddRow = (path: string[]) => {
    setLocalPricing(
      produce(draft => {
        if (!draft) return;
        let current: any = draft;
        path.forEach(p => {
          if (current[p] === undefined) {
              current[p] = {}; // Ensure path exists
          }
          current = current[p];
        });
        
        const newDenomKey = `Baru ${Date.now()}`;
        current[newDenomKey] = { costPrice: 0, sellingPrice: 0 };
      })
    );
  };

  const handleDeleteRow = (path: (string | number)[]) => {
     setLocalPricing(
      produce(draft => {
        if (!draft) return;
        let parent: any = draft;
        for (let i = 0; i < path.length - 1; i++) {
          parent = parent[path[i]];
        }
        delete parent[path[path.length - 1]];
      })
    );
  };


  const handleSaveChanges = async () => {
    if (!firestore || !localPricing) return;

    setIsSaving(true);
    toast({ title: 'Menyimpan...', description: 'Perubahan Anda sedang diproses.' });

    try {
        const finalPricing: FullPricingData = {};

        // Clean up temporary keys before saving
        for (const service of Object.keys(localPricing)) {
            finalPricing[service] = {};
            const serviceData = localPricing[service];
            
            // Check if service has providers (e.g., Pulsa)
            const hasProviders = Object.values(serviceData).some(val => typeof val === 'object' && ('costPrice' in val) === false);

            if (hasProviders) {
                 for (const provider of Object.keys(serviceData)) {
                    finalPricing[service][provider] = {};
                    const providerData = serviceData[provider] as ProviderPricing;
                     for (const denom of Object.keys(providerData)) {
                        if (!denom.startsWith('Baru ')) {
                            finalPricing[service][provider][denom] = providerData[denom];
                        }
                     }
                 }
            } else { // Service without providers (e.g., Token Listrik)
                for (const denom of Object.keys(serviceData)) {
                    if (!denom.startsWith('Baru ')) {
                        (finalPricing[service] as ProviderPricing)[denom] = serviceData[denom] as PriceObject;
                    }
                }
            }
        }
        
        await setDoc(doc(firestore, 'appConfig', 'ppobPricing'), { data: finalPricing }, { merge: true });
        toast({ title: 'Sukses', description: 'Data harga PPOB berhasil diperbarui.' });
        onDone();
    } catch (error) {
        console.error("Error saving PPOB pricing:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan saat menyimpan data.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const renderPriceRows = (data: ProviderPricing, path: string[]) => {
      return Object.entries(data).map(([denom, prices]) => (
        isMobile ? (
          <Card key={denom} className="mb-3">
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <Input
                  defaultValue={denom.startsWith('Baru ') ? '' : denom}
                  onBlur={(e) => handleDenomChange([...path], denom, e.target.value)}
                  placeholder="Isi Denom/Paket"
                  className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                />
                 <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteRow([...path, denom])}>
                    <Trash2 size={16} />
                </Button>
              </div>
              <div className="space-y-2">
                 <div>
                    <label className="text-xs text-muted-foreground">Harga Modal</label>
                    <Input type="text" value={formatToRupiah(prices.costPrice)} onChange={(e) => handleInputChange([...path, denom], 'costPrice', e.target.value)} className="h-10 text-base" />
                 </div>
                 <div>
                    <label className="text-xs text-muted-foreground">Harga Jual</label>
                    <Input type="text" value={formatToRupiah(prices.sellingPrice)} onChange={(e) => handleInputChange([...path, denom], 'sellingPrice', e.target.value)} className="h-10 text-base" />
                 </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <TableRow key={denom}>
            <TableCell className="font-medium">
              <Input
                defaultValue={denom.startsWith('Baru ') ? '' : denom}
                onBlur={(e) => handleDenomChange([...path], denom, e.target.value)}
                placeholder="Isi Denom/Paket"
                className="h-9"
              />
            </TableCell>
            <TableCell>
              <Input type="text" value={formatToRupiah(prices.costPrice)} onChange={(e) => handleInputChange([...path, denom], 'costPrice', e.target.value)} className="h-9 text-right" />
            </TableCell>
            <TableCell>
              <Input type="text" value={formatToRupiah(prices.sellingPrice)} onChange={(e) => handleInputChange([...path, denom], 'sellingPrice', e.target.value)} className="h-9 text-right" />
            </TableCell>
            <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteRow([...path, denom])}>
                    <Trash2 size={16} />
                </Button>
            </TableCell>
          </TableRow>
        )
      ));
  }
  

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-4 pt-4 pb-6">
            <p className="text-sm text-muted-foreground">
                Atur harga modal dan harga jual untuk setiap produk PPOB. Perubahan akan langsung memengaruhi form transaksi.
            </p>
            {isLoading || !localPricing ? (
                <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <Accordion type="multiple" className="w-full" defaultValue={['Pulsa', 'Token Listrik', 'Paket Data']}>
                  {(Object.keys(localPricing) as (keyof FullPricingData)[]).map((serviceName) => {
                      const serviceData = localPricing[serviceName];
                      const hasProviders = Object.values(serviceData).some(val => typeof val === 'object' && ('costPrice' in val) === false);

                      return (
                          <AccordionItem value={serviceName} key={serviceName}>
                              <AccordionTrigger>{serviceName}</AccordionTrigger>
                              <AccordionContent>
                                {hasProviders ? (
                                  <Accordion type="multiple" className="w-full pl-2 md:pl-4" defaultValue={Object.keys(serviceData)[0] ? [`${serviceName}-${Object.keys(serviceData)[0]}`] : []}>
                                    {Object.entries(serviceData).map(([providerName, providerData]) => (
                                      <AccordionItem value={`${serviceName}-${providerName}`} key={`${serviceName}-${providerName}`}>
                                        <AccordionTrigger>{providerName}</AccordionTrigger>
                                        <AccordionContent>
                                          {isMobile ? (
                                              <div>{renderPriceRows(providerData as ProviderPricing, [serviceName, providerName])}</div>
                                          ) : (
                                              <Table>
                                                  <TableHeader>
                                                      <TableRow>
                                                        <TableHead className="w-[40%]">Denom/Paket</TableHead>
                                                        <TableHead className="text-right">Harga Modal</TableHead>
                                                        <TableHead className="text-right">Harga Jual</TableHead>
                                                        <TableHead className="text-right"></TableHead>
                                                      </TableRow>
                                                  </TableHeader>
                                                  <TableBody>{renderPriceRows(providerData as ProviderPricing, [serviceName, providerName])}</TableBody>
                                              </Table>
                                          )}
                                          <div className="mt-4">
                                            <Button variant="outline" size="sm" onClick={() => handleAddRow([serviceName, providerName])}>
                                              <Plus className="mr-2 h-4 w-4" /> Tambah Item
                                            </Button>
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    ))}
                                  </Accordion>
                                ) : (
                                  <>
                                    {isMobile ? (
                                      <div>{renderPriceRows(serviceData as ProviderPricing, [serviceName])}</div>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                            <TableRow>
                                            <TableHead className="w-[40%]">Denom</TableHead>
                                            <TableHead className="text-right">Harga Modal</TableHead>
                                            <TableHead className="text-right">Harga Jual</TableHead>
                                            <TableHead className="text-right"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>{renderPriceRows(serviceData as ProviderPricing, [serviceName])}</TableBody>
                                      </Table>
                                    )}
                                    <div className="mt-4">
                                      <Button variant="outline" size="sm" onClick={() => handleAddRow([serviceName])}>
                                        <Plus className="mr-2 h-4 w-4" /> Tambah Denom
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </AccordionContent>
                          </AccordionItem>
                      );
                  })}
                </Accordion>
            )}
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

    