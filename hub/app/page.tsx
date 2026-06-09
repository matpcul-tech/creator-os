import Nav from '@/components/Nav'
import Hero from '@/components/Hero'
import Traction from '@/components/Traction'
import Tools from '@/components/Tools'
import Workflow from '@/components/Workflow'
import WhyNow from '@/components/WhyNow'
import PartnerSection from '@/components/PartnerSection'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import CTABanner from '@/components/CTABanner'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <Traction />
      <Tools />
      <Workflow />
      <WhyNow />
      <PartnerSection />
      <Pricing />
      <FAQ />
      <CTABanner />
      <Footer />
    </>
  )
}
