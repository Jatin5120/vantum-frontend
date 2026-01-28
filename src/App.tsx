import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VoiceChat } from './components/VoiceChat/VoiceChat';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<VoiceChat />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
