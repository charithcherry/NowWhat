import Link from "next/link";
import { Dumbbell, Apple, Droplet, Activity } from "lucide-react";
import { Navigation } from "@/components/Navigation";

export default function Home() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen pt-16">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-doom">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
                <span className="text-doom-text">Your Complete</span>
                <br />
                <span className="bg-gradient-to-r from-doom-primary via-doom-accent to-doom-secondary bg-clip-text text-transparent">
                  Health Companion
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-doom-muted max-w-3xl mx-auto mb-10">
                Track fitness, nutrition, skin health, sleep, and more—all connected in one unified platform.
                <br className="hidden sm:block" />
                Where every system talks to every other.
              </p>
              <Link
                href="/fitness"
                className="inline-block bg-doom-primary text-doom-bg font-semibold px-8 py-4 rounded-lg hover:scale-105 transition-transform"
              >
                Start Your Journey
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Dumbbell className="w-8 h-8" />}
              title="Physical Fitness"
              description="AI-powered form analysis, rep counting, and injury prevention"
              href="/fitness"
              color="doom-primary"
            />
            <FeatureCard
              icon={<Apple className="w-8 h-8" />}
              title="Nutrition"
              description="Smart meal planning based on your workouts and goals"
              href="/nutrition"
              color="green-400"
            />
            <FeatureCard
              icon={<Droplet className="w-8 h-8" />}
              title="Skin Analysis"
              description="Track skin health and correlate with lifestyle factors"
              href="/skin"
              color="blue-400"
            />
            <FeatureCard
              icon={<Activity className="w-8 h-8" />}
              title="Holistic Insights"
              description="Discover connections between all aspects of your health"
              href="/fitness"
              color="doom-accent"
            />
          </div>
        </div>

        {/* Unique Value Prop */}
        <div className="bg-doom-surface border-y border-doom-primary/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-3xl font-bold text-center mb-4">
              What Makes Us <span className="text-doom-primary">Different</span>
            </h2>
            <p className="text-doom-muted text-center max-w-3xl mx-auto text-lg">
              Most apps are siloed—fitness app, skin app, nutrition app. We connect them all.
              <br />
              Your workout quality affects your nutrition needs, which affects your skin, which affects your sleep.
              <br />
              <span className="text-doom-primary font-semibold">One pipeline. One complete picture.</span>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: string;
}

function FeatureCard({ icon, title, description, href, color }: FeatureCardProps) {
  return (
    <Link href={href}>
      <div className="group p-6 rounded-xl bg-doom-surface border border-doom-primary/20 hover:border-doom-primary/50 transition-all hover:scale-105">
        <div className={`text-${color} mb-4 group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2 text-doom-text">{title}</h3>
        <p className="text-doom-muted text-sm">{description}</p>
      </div>
    </Link>
  );
}
