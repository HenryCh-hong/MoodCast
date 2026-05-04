// app/page.tsx
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ExampleSessionCard } from '@/components/landing/ExampleSessionCard';
import { OpenSourceSection } from '@/components/landing/OpenSourceSection';

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ExampleSessionCard />
      <OpenSourceSection />
      <footer className="border-t border-mc-border px-6 py-8 text-center text-[11px] font-mono text-mc-dim">
        Moodcast does not stream, host, or distribute music. Track suggestions are AI-generated text only.
      </footer>
    </>
  );
}
