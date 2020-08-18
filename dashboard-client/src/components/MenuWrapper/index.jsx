import React from 'react';
import { Link } from 'react-router-dom';

export function MenuComponent({
    guilds,
}) {
    // Dynamic Rendering
    return (
        <div>
            <h1>Hello</h1>
            {guilds.map((guild) => (
                <div>
                    <li>{guild.name}</li>
                    <Link to={`/dashboard/${guild.id}`}>View Dashboard</Link>
                </div>
            ))}
        </div>
    );
}