import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Test connection on startup
async function testConnection() {
    const session = driver.session();
    try {
        await session.run('RETURN 1');
        console.log('✅ Neo4j connection successful');
    } catch (error) {
        console.error('❌ Neo4j connection failed:', error);
    } finally {
        await session.close();
    }
}

testConnection();

export default driver;
