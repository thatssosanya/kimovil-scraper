/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import "./index.css";
import App from "./App.tsx";
import Slugs from "./pages/slugs/Slugs.tsx";

const root = document.getElementById("root");

render(
  () => (
    <Router>
      <Route path="/" component={App} />
      <Route path="/slugs" component={Slugs} />
    </Router>
  ),
  root!
);
