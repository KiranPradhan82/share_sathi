import satori from 'satori';

// Test: div with 1 child in array, NO display
const tree4 = {
  type: 'div',
  props: {
    style: { width: 200, height: 200 },
    children: [
      { type: 'div', props: { style: { fontSize: 20 }, children: 'hello' } },
    ],
  },
};

try {
  const svg = await satori(tree4, { width: 200, height: 200, fonts: [] });
  console.log('Test 1-element-array NO display: SUCCESS');
} catch (e) {
  console.log('Test 1-element-array NO display: ERROR ->', e.message);
}

// Test: div with children: [] empty array, no display
const tree5 = {
  type: 'div',
  props: {
    style: { width: 200, height: 200, backgroundColor: 'red' },
    children: [],
  },
};

try {
  const svg = await satori(tree5, { width: 200, height: 200, fonts: [] });
  console.log('Test empty-array NO display: SUCCESS');
} catch (e) {
  console.log('Test empty-array NO display: ERROR ->', e.message);
}

// Test: div with 2 children NO display
const tree3 = {
  type: 'div',
  props: {
    style: { width: 200, height: 200 },
    children: [
      { type: 'div', props: { style: { fontSize: 20 }, children: 'a' } },
      { type: 'div', props: { style: { fontSize: 20 }, children: 'b' } },
    ],
  },
};

try {
  const svg = await satori(tree3, { width: 200, height: 200, fonts: [] });
  console.log('Test 2-children NO display: SUCCESS');
} catch (e) {
  console.log('Test 2-children NO display: ERROR ->', e.message);
}

// Test: div with children as single object, NO display
const tree2 = {
  type: 'div',
  props: {
    style: { width: 200, height: 200 },
    children: { type: 'div', props: { style: { fontSize: 20 }, children: 'hello' } },
  },
};

try {
  const svg = await satori(tree2, { width: 200, height: 200, fonts: [] });
  console.log('Test single-object children NO display: SUCCESS');
} catch (e) {
  console.log('Test single-object children NO display: ERROR ->', e.message);
}

// Test: NESTED - parent has flex, child div has 2 children no display
const tree6 = {
  type: 'div',
  props: {
    style: { width: 200, height: 200, display: 'flex', flexDirection: 'column' },
    children: [
      {
        type: 'div',
        props: {
          style: { padding: 10 },
          children: [
            { type: 'div', props: { style: { fontSize: 20 }, children: 'a' } },
            { type: 'div', props: { style: { fontSize: 20 }, children: 'b' } },
          ],
        },
      },
    ],
  },
};

try {
  const svg = await satori(tree6, { width: 200, height: 200, fonts: [] });
  console.log('Test NESTED 2-children no display: SUCCESS');
} catch (e) {
  console.log('Test NESTED 2-children no display: ERROR ->', e.message);
}
