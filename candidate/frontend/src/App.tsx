import { FC } from 'react';
import CandidateForm from './components/CandidateForm';
import './index.css';

const App: FC = () => {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <CandidateForm/>
    </div>
  );
}

export default App;