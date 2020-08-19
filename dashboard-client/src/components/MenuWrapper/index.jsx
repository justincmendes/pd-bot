import React from 'react';
import { Link } from 'react-router-dom';

export function MenuComponent({
    guilds,
}) {
    // Dynamic Rendering
    return (
        <div>
            <h1>Hello</h1>
            {guilds.included.map((guild) => (
                <div>
                    <li>{guild.name}</li>
                    <Link to={`/dashboard/${guild.id}`}>View Dashboard</Link>
                </div>
            ))}
            {guilds.excluded.map((guild) => (
                <div>
                    <li>{guild.name}</li>
                    <a href ={'http://discord.com/oauth2/authorize?client_id=734097718078603284&permissions=126016&scope=bot'}>
                        Invite Bot</a>
                </div>
            ))}
        </div>
    );
}