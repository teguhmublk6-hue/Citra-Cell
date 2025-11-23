
"use client";

import { quickServices, ppobServices } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { CarouselApi } from "@/components/ui/carousel"
import React from 'react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CurrentShiftStatus } from '@/lib/data';

type ServiceType = 'customerTransfer' | 'withdraw' | 'topUp' | 'customerVAPayment' | 'EDCService' | 'Emoney' | 'KJP' | 'Pulsa' | 'Token Listrik' | 'Data' | 'PLN' | 'PDAM' | 'BPJS' | 'Wifi' | 'Paket Telpon';
interface QuickServicesProps {
    onServiceClick: (service: ServiceType) => void;
}

export default function QuickServices({ onServiceClick }: QuickServicesProps) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [count, setCount] = React.useState(0)
  const firestore = useFirestore();

  const shiftStatusDocRef = useMemoFirebase(() => doc(firestore, 'appConfig', 'currentShiftStatus'), [firestore]);
  const { data: shiftStatus } = useDoc<CurrentShiftStatus>(shiftStatusDocRef);

  const serviceGroups = [
    { title: 'BRILink', services: quickServices },
    { title: 'PPOB', services: ppobServices },
  ];

  React.useEffect(() => {
    if (!api) {
      return
    }

    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap())
    })
  }, [api])
  
  const handleTitleClick = () => {
    if (api) {
      const nextSlide = (current + 1) % count;
      api.scrollTo(nextSlide);
    }
  }

  const handleServiceClick = (serviceId: ServiceType) => {
    if (!shiftStatus?.isActive) {
        // Optionally, show a toast or message that a shift needs to be started
        console.warn("Shift is not active. Cannot perform service.");
        return;
    }
    onServiceClick(serviceId);
  }

  return (
    <Card className="bg-card/80 backdrop-blur-md border-border/20 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
             <button onClick={handleTitleClick} className="text-left group focus:outline-none">
                 <CardTitle className="text-lg transition-colors group-hover:text-primary">{serviceGroups[current].title}</CardTitle>
             </button>
            <div className="flex items-center justify-center space-x-2">
              {serviceGroups.map((_, index) => (
                <button
                  key={index}
                  onClick={() => api?.scrollTo(index)}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    index === current ? "bg-primary" : "bg-muted"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2">
          <Carousel setApi={setApi}>
            <CarouselContent>
              {serviceGroups.map((group, groupIndex) => (
                <CarouselItem key={groupIndex}>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 text-center px-4">
                      {group.services.map((service, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleServiceClick(service.id as ServiceType)}
                          className="flex flex-col items-center gap-2 group"
                          aria-label={service.label}
                          disabled={!shiftStatus?.isActive}
                        >
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-transform shadow-lg",
                            shiftStatus?.isActive ? "group-hover:scale-105" : "opacity-50 cursor-not-allowed",
                            "bg-green-600 dark:bg-blue-600"
                            )}>
                            <service.icon size={28} strokeWidth={1.5} />
                          </div>
                          <span className={cn("text-xs text-muted-foreground font-medium text-center leading-tight mt-1", !shiftStatus?.isActive && "opacity-50")}>{service.label}</span>
                        </button>
                      ))}
                    </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </CardContent>
    </Card>
  );
}
