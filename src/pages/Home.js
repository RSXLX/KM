import React from 'react';
import { Card, Statistic, Typography } from 'antd';

const { Title } = Typography;


const Home = ({ data }) => {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {data.map((match) => (
                <Card key={match.id} title={<Title level={5}>{match.league}</Title>} style={{ width: 300 }}>
                    {match.isLive && (
                        <>
                            <p>{match.homeTeam} - {match.awayTeam}</p>
                            <Statistic title="Score" value={`${match.homeScore} - ${match.awayScore}`} />
                            <p>Time: {match.time}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Statistic title="H" value={match.odds.home} />
                                <Statistic title="D" value={match.odds.draw} />
                                <Statistic title="A" value={match.odds.away} />
                            </div>
                        </>
                    )}
                </Card>
            ))}
        </div>
    );
};

export default Home;