/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import "./index.css";
import "./stores/theme"; // Initialize theme early to avoid FOUC
import App from "./App.tsx";
import Slugs from "./pages/slugs/Slugs.tsx";
import Widgets from "./pages/widgets/Widgets.tsx";
import WidgetDebug from "./pages/widgets/WidgetDebug.tsx";
import Analytics from "./pages/analytics/Analytics.tsx";
import Login from "./pages/auth/Login.tsx";
import Register from "./pages/auth/Register.tsx";
import YandexLinks from "./pages/yandex-links/YandexLinks.tsx";
import TelegramBackfill from "./pages/telegram/TelegramBackfill.tsx";

const root = document.getElementById("root");

render(
  () => (
    <Router>
      <Route path="/" component={App} />
      <Route path="/slugs" component={Slugs} />
      <Route path="/widgets" component={Widgets} />
      <Route path="/widgets/debug" component={WidgetDebug} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/yandex-links" component={YandexLinks} />
      <Route path="/telegram" component={TelegramBackfill} />
      <Route path="/auth/login" component={Login} />
      <Route path="/auth/register" component={Register} />
    </Router>
  ),
  root!,
);
