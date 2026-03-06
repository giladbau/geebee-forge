<svelte:head>
  <title>GeeBee Forge</title>
</svelte:head>

<div class="landing">
  <h1>GeeBee Forge</h1>
  <p class="subtitle">Cloudflare Pages Demo Hub</p>

  <div class="grid">
    <article role="article" data-testid="demo-card" class="card">
      <h2 data-testid="card-title">Constellation</h2>
      <p class="card-desc">An interactive Three.js star field — data's neural sky.</p>
      <a href="/constellation" class="card-link">Launch Constellation</a>
    </article>
  </div>
</div>

<style>
  .landing {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem 2rem;
  }

  h1 {
    font-size: 3rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
    background: linear-gradient(135deg, #e0e0e0, #6ba3ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: #888;
    font-size: 1rem;
    margin: 0.5rem 0 3rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    width: 100%;
    max-width: 900px;
  }

  .card {
    background: #151515;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    padding: 2rem;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  }

  .card:hover {
    border-color: #4a7fff;
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(74, 127, 255, 0.12);
  }

  .card h2 {
    margin: 0 0 0.75rem;
    font-size: 1.4rem;
    color: #e0e0e0;
  }

  .card-desc {
    color: #999;
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0 0 1.5rem;
  }

  .card-link {
    display: inline-block;
    color: #6ba3ff;
    text-decoration: none;
    font-weight: 500;
    font-size: 0.9rem;
    padding: 0.5rem 1rem;
    border: 1px solid #2a3a5a;
    border-radius: 6px;
    transition: background 0.2s, border-color 0.2s;
  }

  .card-link:hover {
    background: rgba(107, 163, 255, 0.1);
    border-color: #6ba3ff;
  }
</style>
