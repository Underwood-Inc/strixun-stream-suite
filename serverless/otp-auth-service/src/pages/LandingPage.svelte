<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '../components/Header.svelte';
  import Hero from '../components/Hero.svelte';
  import Features from '../components/Features.svelte';
  import Security from '../components/Security.svelte';
  import CodeExamples from '../components/CodeExamples.svelte';
  import Limitations from '../components/Limitations.svelte';
  import SelfHosting from '../components/SelfHosting.svelte';
  import TechnicalDocs from '../components/TechnicalDocs.svelte';
  import ApiUsageBar from '../components/ApiUsageBar.svelte';
  import Footer from '../components/Footer.svelte';

  // Smooth scroll for anchor links
  onMount(() => {
    if (typeof window !== 'undefined') {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          const target = document.querySelector(this.getAttribute('href') || '');
          if (target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        });
      });
    }
  });
</script>

<main>
  <Header />

  <ApiUsageBar />

  <Hero />

  <Features />

  <Security />

  <CodeExamples />

  <Limitations />

  <SelfHosting />

  <TechnicalDocs />

  <Footer />
</main>

<style>
  main {
    min-height: 100vh;
  }
</style>

