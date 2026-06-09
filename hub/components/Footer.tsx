export default function Footer() {
  return (
    <footer>
      <div className="footer-wrap">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="fl">
              <span className="c1">Creator</span><span className="c2">Stack</span>
            </div>
            <p>Sovereign creator infrastructure. Built by one. Designed for many.</p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h4>Products</h4>
              <ul>
                <li><a href="#tools">Creator OS</a></li>
                <li><a href="#tools">Prompt Architect</a></li>
                <li><a href="#tools">Manuscript Studio</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#why">Why Now</a></li>
                <li><a href="#partner">Partners</a></li>
                <li><a href="#partner">Acquisition</a></li>
                <li><a href="mailto:matt@sovereignshieldtechnologies.com">Contact</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Terms of Use</a></li>
                <li><a href="#">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Sovereign Shield Technologies LLC · Ada, Oklahoma</p>
          <p className="footer-sst">An <span>Chickasaw Nation</span> sovereign enterprise</p>
        </div>
      </div>
    </footer>
  )
}
