import { Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Wizard } from "./pages/Wizard";
import { Quotes } from "./pages/Quotes";
import { Agents } from "./pages/Agents";
import { About } from "./pages/About";
import { Seo } from "./components/Seo";
import { Link } from "react-router-dom";
import { fireAnalytics } from "./lib/analytics";

/** Fires a page_view analytics event on every client-side route change. */
function PageViewTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    fireAnalytics("page_view", { page: pathname });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="page">
      <Seo
        title="Page not found — QuotePilot"
        description="That page doesn't exist. Head back home or start a quote."
        path="/404"
      />
      <div className="container">
        <div className="empty-state glass">
          <h1>Lost? Let's get you back on the road.</h1>
          <p>That page doesn't exist.</p>
          <Link to="/" className="btn btn-primary">Back home</Link>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <PageViewTracker />
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="quote" element={<Wizard />} />
        <Route path="quotes/:jobId" element={<Quotes />} />
        <Route path="agents" element={<Agents />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </>
  );
}
