export default function Nav() {
  return (
    <nav>
      <a className="nav-logo" href="#">
        <span className="c1">Creator</span><span className="c2">Stack</span>
      </a>
      <ul className="nav-center">
        <li><a href="#tools">Tools</a></li>
        <li><a href="#workflow">Workflow</a></li>
        <li><a href="#why">Why Now</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#partner">Partner</a></li>
      </ul>
      <div className="nav-right">
        <a href="#partner" className="nav-partner">Acquisition Inquiry</a>
        <a href="#pricing" className="nav-cta">Get Started</a>
      </div>
    </nav>
  )
}
