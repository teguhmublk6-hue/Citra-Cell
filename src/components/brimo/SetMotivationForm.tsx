
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import type { AppConfig, MotivationFormValues } from '@/lib/types';
import { MotivationFormSchema } from '@/lib/types';
import { Textarea } from '../ui/textarea';
import { useEffect } from 'react';
import { Input } from '../ui/input';

interface SetMotivationFormProps {
  onDone: () => void;
}

export default function SetMotivationForm({ onDone }: SetMotivationFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const motivationDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'appConfig', 'motivation');
  }, [firestore]);

  const { data: motivationData } = useDoc<AppConfig>(motivationDocRef);

  const form = useForm<MotivationFormValues>({
    resolver: zodResolver(MotivationFormSchema),
    defaultValues: {
      motivationQuote: '',
      motivationAuthor: '',
    },
  });

  useEffect(() => {
    if (motivationData) {
      form.setValue('motivationQuote', motivationData.motivationQuote);
      form.setValue('motivationAuthor', motivationData.motivationAuthor || '');
    }
  }, [motivationData, form]);

  const onSubmit = (values: MotivationFormValues) => {
    if (!firestore) {
      toast({ variant: "destructive", title: "Error", description: "Database tidak tersedia." });
      return;
    }
    
    const docRef = doc(firestore, 'appConfig', 'motivation');
    setDocumentNonBlocking(docRef, values, { merge: true });
    
    toast({ title: "Sukses", description: "Kutipan motivasi berhasil disimpan." });
    onDone();
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="flex-1 space-y-4 pt-4 pb-6">
          <FormField
            control={form.control}
            name="motivationQuote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kutipan Motivasi</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tulis kutipan motivasi di sini..."
                    className="resize-none h-32"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="motivationAuthor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Penulis Kutipan (Opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="cth: BRILink Manager" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex gap-2 pt-0 pb-4 border-t border-border -mx-6 px-6 pt-4">
          <Button type="button" variant="outline" onClick={onDone} className="w-full">
            Batal
          </Button>
          <Button type="submit" className="w-full">
            Simpan
          </Button>
        </div>
      </form>
    </Form>
  );
}
