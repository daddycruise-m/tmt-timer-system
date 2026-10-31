import React, { useState } from "react";
import DisplayScreen from './components/DisplayScreen';
import ControllerScreen from "./components/ControllerScreen";
import './index.css'
import LandingPage from "./components/LandingPage";

export default function App (){
    const [role, setRole] = useState(null);

    return(
        <div>{!role && <LandingPage onSelectRole={setRole} />}
        { role === 'display' && <DisplayScreen onBack={() => setRole(null)} />}
        { role === 'controller' && <ControllerScreen onBack={() => setRole(null)} />}</div>
    );
}