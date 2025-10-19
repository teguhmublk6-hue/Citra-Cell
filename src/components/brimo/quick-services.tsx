
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

type ServiceType = 'customerTransfer' | 'withdraw' | 'topUp';
interface QuickServicesProps {
    onServiceClick: (service: ServiceType) => void;
}

export default function QuickServices({ onServiceClick }: QuickServicesProps) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [count, setCount] = React.useState(0)

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

  const handleServiceClick = (label: string) => {
    if (label === 'Transfer') {
        onServiceClick('customerTransfer');
    }
    if (label === 'Tarik Tunai') {
        onServiceClick('withdraw');
    }
    if (label === 'Top Up') {
        onServiceClick('topUp');
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur-md border-border/20 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">{serviceGroups[current].title}</CardTitle>
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
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center px-4">
                      {group.services.map((service, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleServiceClick(service.label)}
                          className="flex flex-col items-center gap-2 group"
                          aria-label={service.label}
                        >
                          <div className={`${service.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-lg`}>
                            <service.icon size={28} strokeWidth={1.5} />
                          </div>
                          <span className="text-xs text-muted-foreground font-medium text-center leading-tight mt-1">{service.label}</span>
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

    