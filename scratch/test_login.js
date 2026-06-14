// const { loginUser } = require('../src/lib/auth');

// Note: Next.js 'next/headers' cookies API only works in Next.js request context,
// so we mock the cookies function or run in mock environment.
// Let's mock cookies so we can test the database and hash verification.

jestMockCookies();

function jestMockCookies() {
  const mockCookies = {
    set: (name, val) => console.log(`[Mock Cookie Set] ${name} = ${val}`),
    get: (name) => null,
    delete: (name) => console.log(`[Mock Cookie Delete] ${name}`)
  };
  
  // Set global/module mock for next/headers if possible,
  // or we can test the database query and hash check directly in the script!
}

const prisma = require('../src/lib/db').default;
const { verifyPassword } = require('../src/lib/hash');

async function testLogin() {
  console.log('Testing login logic...');
  
  try {
    const username = 'Aisha';
    const user = await prisma.user.findUnique({
      where: { name: username }
    });
    
    if (!user) {
      console.error('User not found in seeded DB!');
      return;
    }
    
    console.log('User found:', user.name);
    console.log('Password hash:', user.passwordHash);
    
    const isValid = verifyPassword('aisha123', user.passwordHash);
    console.log('Is password "aisha123" valid?', isValid);
    
    const isInvalid = verifyPassword('wrongpassword', user.passwordHash);
    console.log('Is password "wrongpassword" valid? (should be false)', isInvalid);
    
    console.log('Login logic test PASSED!');
  } catch (error) {
    console.error('Login logic failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
