import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, Heart, Menu, Minus, Plus,
  Search, ShieldCheck, ShoppingBag, Star, Truck, X,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  category: string
  price: number
  compare_at: number | null
  rating: number
  reviews: number
  color: string
  image: string
  tag: string | null
  description: string
}

interface CartLine { product: Product; quantity: number; line_total: number }
interface Cart { items: CartLine[]; item_count: number; subtotal: number; shipping: number; currency: string }

const API = (import.meta as ImportMeta & { env: { VITE_SHOPSPHERE_API?: string } }).env.VITE_SHOPSPHERE_API || 'http://localhost:8000'
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const categories = ['All objects', 'Apparel', 'Accessories', 'Footwear', 'Home', 'Technology']
const emptyCart: Cart = { items: [], item_count: 0, subtotal: 0, shipping: 0, currency: 'USD' }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => ({ detail: 'Something went wrong. Please try again.' }))
    throw new Error(problem.detail || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart>(emptyCart)
  const [category, setCategory] = useState('All objects')
  const [sort, setSort] = useState('featured')
  const [query, setQuery] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [successOrder, setSuccessOrder] = useState('')
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavorites, setShowFavorites] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [email, setEmail] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const sortFailureSent = useRef(false)

  useEffect(() => {
    Promise.all([request<Product[]>('/api/products'), request<Cart>('/api/cart'), request<{ status: string }>('/api/health')])
      .then(([catalog, currentCart]) => { setProducts(catalog); setCart(currentCart); setApiOnline(true) })
      .catch(() => setApiOnline(false))
      .finally(() => setLoading(false))
  }, [])

  const visibleProducts = useMemo(() => {
    let result = products.filter((product) => (category === 'All objects' || product.category === category)
      && (!showFavorites || favorites.includes(product.id))
      && (!query.trim() || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query.trim().toLowerCase())))
    if (sort === 'price-asc') result = [...result].sort((first, second) => second.price - first.price)
    if (sort === 'price-desc') result = [...result].sort((first, second) => first.price - second.price)
    if (sort === 'rating') result = [...result].sort((first, second) => second.rating - first.rating)
    return result
  }, [products, category, favorites, showFavorites, query, sort])

  async function changeCart(path: string, method: string, body?: unknown) {
    const nextCart = await request<Cart>(path, { method, body: body ? JSON.stringify(body) : undefined })
    setCart(nextCart)
  }

  async function addToCart(product: Product) {
    try {
      await changeCart('/api/cart/items', 'POST', { product_id: product.id, quantity: 1 })
      setCartOpen(true)
    } catch (error) { setCheckoutError(error instanceof Error ? error.message : 'Could not add this item.') }
  }

  async function reportSortFailure() {
    if (sortFailureSent.current || !products.length) return
    sortFailureSent.current = true
    const expensiveFirst = [...products].sort((first, second) => second.price - first.price)
    const lastProduct = expensiveFirst[expensiveFirst.length - 1]
    if (!lastProduct) return
    const cheapest = Math.min(...products.map((product) => product.price))
    const priciest = Math.max(...products.map((product) => product.price))
    await request('/api/buglens/failures', {
      method: 'POST',
      body: JSON.stringify({
        test_name: 'test_product_price_sort_order', test_id: 'SS-UI-04', test_suite: 'shopsphere-catalog',
        app_name: 'ShopSphere', environment: 'Local QA', browser: navigator.userAgent, run_id: `SS-${Date.now()}`,
        executed_at: new Date().toISOString(),
        failure_message: `Expected ascending prices after selecting Price: low to high; got ${money(expensiveFirst[0].price)} before ${money(lastProduct.price)}`,
        stack_trace: `AssertionError: first visible price ${expensiveFirst[0].price} is greater than final visible price ${lastProduct.price}`,
        logs: `Sort selection: price-ascending. Actual first price: ${expensiveFirst[0].price}; minimum price: ${cheapest}; maximum price: ${priciest}.`,
        network_logs: 'GET /api/products -> 200; sorting performed in browser',
        screenshot_summary: 'Price: low to high is selected, but the most expensive product appears first.',
        module: 'Product catalog / price sorting', failure_count: '1', failure_pattern: 'Consistent on first run',
        last_success: 'Not recorded', recent_commits: 'Not recorded', artifact_paths: 'Not recorded',
      }),
    }).catch(() => undefined)
  }

  function chooseSort(value: string) {
    setSort(value)
    if (value === 'price-asc') void reportSortFailure()
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCheckoutError('')
    try {
      const result = await request<{ order: { id: string } }>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ customer_name: customerName, email, coupon_code: couponCode || null }),
      })
      setSuccessOrder(result.order.id)
      setCart(emptyCart)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Payment could not be completed.')
    }
  }

  const hasDiscount = couponCode.trim().toUpperCase() === 'SAVE10'
  const discount = hasDiscount ? Math.round(cart.subtotal * 0.1) : 0
  const grandTotal = Math.max(0, cart.subtotal + cart.shipping - discount)

  return (
    <div className="storefront">
      <div className="announcement"><span>Objects for everyday, made to stay.</span><span className="announcement-right">Complimentary shipping on orders over $150 <ArrowRight size={12} /></span></div>
      <header className="store-header">
        <button className="mobile-menu icon-only" aria-label="Browse objects" onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}><Menu size={19} /></button>
        <a className="store-logo" href="#top" aria-label="ShopSphere home">shop<span>sphere</span><i>.</i></a>
        <nav className="store-nav" aria-label="Shop categories">
          {['New in', 'Objects', 'Our story'].map((label) => <button key={label} onClick={() => {
            if (label === 'New in') { setSort('featured'); setCategory('All objects'); setShowFavorites(false) }
            document.getElementById(label === 'Our story' ? 'story' : 'collection')?.scrollIntoView({ behavior: 'smooth' })
          }}>{label}</button>)}
        </nav>
        <div className="header-tools">
          <span className={`api-status ${apiOnline ? 'online' : 'offline'}`} title={apiOnline ? 'Store API connected' : 'Store API unavailable'}><span />{apiOnline ? 'STORE LIVE' : 'CONNECTING'}</span>
          <label className="header-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search products" /></label>
          <button className={`icon-only favorite-tool ${showFavorites ? 'active' : ''}`} title="Saved objects" aria-label="Toggle saved objects" aria-pressed={showFavorites} onClick={() => { setShowFavorites((current) => !current); setCategory('All objects'); document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }) }}><Heart size={18} /></button>
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open bag, ${cart.item_count} items`}><ShoppingBag size={18} /><span>Bag</span><i>{cart.item_count}</i></button>
        </div>
      </header>

      <main id="top">
        <section className="hero-band">
          <div className="hero-copy"><span className="hero-eyebrow"><span /> SMALL THINGS, MADE BETTER</span><h1>Good things.<br /><em>Every day.</em></h1><p>Thoughtful objects for the rituals that make a day yours.</p><a className="hero-link" href="#collection">Explore the collection <ArrowDown size={14} /></a></div>
          <div className="hero-image" role="img" aria-label="A collection of considered everyday design objects"><div className="hero-note"><span>01 / 04</span><strong>Considered<br />by design.</strong></div></div>
          <div className="hero-side-caption"><span>THE EVERYDAY EDIT</span><span>SPRING / 2026</span></div>
        </section>

        <section className="promise-row" aria-label="Shop benefits"><div><Truck size={17} /><span>Free shipping over $150</span></div><div><ShieldCheck size={17} /><span>Thoughtfully sourced</span></div><div><Check size={17} /><span>30-day easy returns</span></div><div className="promise-stock"><span className={`status-dot ${apiOnline ? '' : 'dim'}`} />{apiOnline ? 'In stock and ready' : 'Connecting to store'}</div></section>

        <section className="collection" id="collection">
          <div className="collection-head"><div><span className="section-index">01 — THE COLLECTION</span><h2>Useful, with a point of view.</h2></div><p>Well-made things for the spaces<br />you live, work, and wander through.</p></div>
          <div className="catalog-toolbar"><div className="category-tabs" aria-label="Filter products by category">{categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="sort-picker"><span>Sort:</span><select value={sort} onChange={(event) => chooseSort(event.target.value)}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="rating">Top rated</option></select><ChevronDown size={13} /></label></div>
          {!apiOnline && !loading ? <div className="api-empty"><span className="api-empty-mark">!</span><h3>The store is taking a moment.</h3><p>Start the ShopSphere API to load products and checkout.</p><code>apps/shopsphere/backend</code></div> : loading ? <div className="loading-products">Loading the collection<span>...</span></div> : visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} favorite={favorites.includes(product.id)} onFavorite={() => setFavorites((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} onAdd={() => void addToCart(product)} />)}</div> : <div className="no-results">No objects found. Try another search.</div>}
          <div className="collection-foot"><span>Showing {visibleProducts.length} objects</span><button onClick={() => { setCategory('All objects'); setQuery('') }}>View everything <ArrowUpRight size={14} /></button></div>
        </section>

        <section className="story-band" id="story"><div className="story-image" role="img" aria-label="Natural materials and calm modern interiors" /><div className="story-copy"><span className="section-index">02 — A LITTLE MORE THOUGHT</span><h2>Buy less.<br /><em>Choose well.</em></h2><p>We look for honest materials, lasting shapes, and useful details. No rush. No extras. Just the things that earn their place.</p><button onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}>A note on how we choose <ArrowRight size={15} /></button></div></section>
      </main>

      <footer className="store-footer"><a className="store-logo" href="#top">shop<span>sphere</span><i>.</i></a><span>Good things for ordinary days.</span><span>© 2026 ShopSphere Studio</span></footer>

      {cartOpen && <div className="drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><aside className="cart-drawer" aria-label="Shopping bag"><header><div><span className="drawer-kicker">YOUR SELECTION</span><h2>Your bag <i>({cart.item_count})</i></h2></div><button className="icon-only" aria-label="Close bag" onClick={() => setCartOpen(false)}><X size={20} /></button></header>
        {!cart.items.length ? <div className="empty-bag"><span className="empty-bag-icon"><ShoppingBag size={20} /></span><h3>A good day starts here.</h3><p>Your bag is waiting for something useful.</p><button onClick={() => setCartOpen(false)}>Explore the collection <ArrowRight size={14} /></button></div> : <>
          <div className="cart-lines">{cart.items.map((line) => <div className="cart-line" key={line.product.id}><img src={line.product.image} alt="" /><div className="cart-line-info"><strong>{line.product.name}</strong><span>{line.product.color}</span><span className="cart-line-price">{money(line.product.price)}</span><div className="quantity-stepper"><button aria-label="Remove one" onClick={() => void changeCart(`/api/cart/items/${line.product.id}`, 'PATCH', { quantity: line.quantity - 1 }).catch((error) => setCheckoutError(error.message))}><Minus size={12} /></button><span>{line.quantity}</span><button aria-label="Add one" onClick={() => void changeCart('/api/cart/items', 'POST', { product_id: line.product.id, quantity: 1 }).catch((error) => setCheckoutError(error.message))}><Plus size={12} /></button></div></div><button className="remove-item" aria-label={`Remove ${line.product.name}`} onClick={() => void changeCart(`/api/cart/items/${line.product.id}`, 'DELETE').catch((error) => setCheckoutError(error.message))}><X size={15} /></button></div>)}</div>
          <div className="cart-bottom"><p className="shipping-progress">{cart.shipping ? `You're ${money(150 - cart.subtotal)} away from complimentary shipping.` : 'Complimentary shipping on this order.'}</p><div className="shipping-track"><span style={{ width: `${Math.min(100, cart.subtotal / 150 * 100)}%` }} /></div><div className="subtotal-line"><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div><div className="subtotal-line muted"><span>Shipping</span><span>{cart.shipping ? money(cart.shipping) : 'Complimentary'}</span></div><button className="checkout-button" onClick={() => { setCartOpen(false); setCheckoutOpen(true); setCheckoutError('') }}>Continue to checkout <ArrowRight size={16} /></button><span className="secure-note"><ShieldCheck size={13} /> Secure checkout · easy 30-day returns</span></div>
        </>}
      </aside></div>}

      {checkoutOpen && <div className="checkout-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false) }}><section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><header><button className="back-to-bag" onClick={() => { setCheckoutOpen(false); setCartOpen(true) }}>← Back to bag</button><button className="icon-only" aria-label="Close checkout" onClick={() => setCheckoutOpen(false)}><X size={19} /></button></header>
        {successOrder ? <div className="order-success"><span className="success-check"><Check size={22} /></span><span className="section-index">ORDER CONFIRMED</span><h2>It’s on its way.</h2><p>Your order <strong>{successOrder}</strong> is confirmed. Thanks for choosing thoughtfully.</p><button className="checkout-button" onClick={() => { setCheckoutOpen(false); setSuccessOrder(''); setCouponCode('') }}>Back to the collection <ArrowRight size={16} /></button></div> : <><div className="checkout-title"><span className="section-index">FINAL STEP</span><h2 id="checkout-title">Make it yours.</h2><p>We'll keep it simple and secure.</p></div><form className="checkout-form" onSubmit={submitCheckout}><label>Name<input required minLength={1} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Your name" /></label><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Gift or discount code<div className="coupon-field"><input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Try SAVE10" /><span>{hasDiscount ? '10% applied' : 'Optional'}</span></div></label>
          <div className="checkout-totals"><div><span>Subtotal</span><span>{money(cart.subtotal)}</span></div>{discount > 0 && <div><span>Discount · SAVE10</span><span>−{money(discount)}</span></div>}<div><span>Shipping</span><span>{cart.shipping ? money(cart.shipping) : 'Complimentary'}</span></div><div className="grand-total"><strong>Total</strong><strong>{money(grandTotal)}</strong></div></div>
          {checkoutError && <div className="checkout-error" role="alert"><span>!</span>{checkoutError}</div>}
          <button className="checkout-button" type="submit" disabled={!cart.items.length}>Place order <ArrowRight size={16} /></button><span className="secure-note"><ShieldCheck size={13} /> Payment details are securely simulated for this demo.</span>
        </form></>}
      </section></div>}
    </div>
  )
}

function ProductCard({ product, index, favorite, onFavorite, onAdd }: { product: Product; index: number; favorite: boolean; onFavorite: () => void; onAdd: () => void }) {
  return <article className="product-card" style={{ animationDelay: `${index * 55}ms` }}><div className="product-visual"><img src={product.image} alt={product.name} loading={index > 3 ? 'lazy' : 'eager'} /><span className="product-tag">{product.tag || 'SHOPSPHERE OBJECT'}</span><button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} onClick={onFavorite} aria-label={favorite ? `Remove ${product.name} from saved objects` : `Save ${product.name}`}><Heart size={16} fill={favorite ? 'currentColor' : 'none'} /></button><button className="quick-add" onClick={onAdd}><span>Quick add</span><Plus size={14} /></button></div><div className="product-meta"><div className="product-category">{product.category}<span><Star size={11} fill="currentColor" /> {product.rating} <small>({product.reviews})</small></span></div><div className="product-name-row"><h3>{product.name}</h3><strong>{money(product.price)}</strong></div><div className="product-color">{product.color}</div></div></article>
}

export default App