import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Rules from './pages/Rules';
import Settings from './pages/Settings';
import Alerts from './pages/Alerts';
import PromptInjections from './pages/PromptInjections';
import ModelRouting from './pages/ModelRouting';
import ContextManagement from './pages/ContextManagement';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="prompts" element={<PromptInjections />} />
          <Route path="rules" element={<Rules />} />
          <Route path="settings" element={<Settings />} />
          <Route path="router" element={<ModelRouting />} />
          <Route path="context" element={<ContextManagement />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
