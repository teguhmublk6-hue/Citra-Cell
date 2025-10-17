"use client";

import { quickServices, ppobServices } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function QuickServices() {
  const [activeSlide, setActiveSlide] = useState(0);

  const serviceGroups = [
    { title: 'BRILink', services: quickServices },
    { title: 'PPOB', services: ppobServices },
  ];

  return (
    <Card>
      <Carousel onSlideChanged={(api) => setActiveSlide(api.selectedScrollSnap())}>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">{serviceGroups[activeSlide].title}</CardTitle>
            <div className="flex items-center justify-center space-x-2">
              {serviceGroups.map((_, index) => (
                <button
                  key={index}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    index === activeSlide ? "bg-primary" : "bg-muted"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2">
            <CarouselContent>
              {serviceGroups.map((group, groupIndex) => (
                <CarouselItem key={groupIndex}>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center px-4">
                      {group.services.map((service, idx) => (
                        <button
                          key={idx}
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
            <CarouselPrevious className="absolute left-0" />
            <CarouselNext className="absolute right-0" />
        </CardContent>
      </Carousel>
    </Card>
  );
}