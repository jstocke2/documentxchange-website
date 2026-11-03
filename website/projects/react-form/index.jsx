import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function App() {
  function signUp(formData) {
    const data = Object.fromEntries(formData);
    const dietaryRestrictions = formData.getAll('dietaryRestrictions');
    const allData = { ...data, dietaryRestrictions };

    console.log('Submitted React form data:', allData);
  }

  return (
    <main className="page-shell">
      <section className="form-card">
        <p className="eyebrow">React form demonstration</p>
        <h1>Signup form</h1>
        <p className="intro">Submit the form, then open the browser console to inspect the completed data object.</p>

        <form action={signUp}>
          <label htmlFor="email">Email</label>
          <input id="email" defaultValue="joe@schmoe.com" type="email" name="email" placeholder="joe@schmoe.com" required />

          <label htmlFor="password">Password</label>
          <input id="password" defaultValue="password123" type="password" name="password" required />

          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue="This is a description" />

          <fieldset>
            <legend>Employment status</legend>
            <label><input type="radio" name="employmentStatus" value="unemployed" /> Unemployed</label>
            <label><input type="radio" name="employmentStatus" value="part-time" /> Part-time</label>
            <label><input type="radio" name="employmentStatus" defaultChecked value="full-time" /> Full-time</label>
          </fieldset>

          <fieldset>
            <legend>Dietary restrictions</legend>
            <label><input type="checkbox" name="dietaryRestrictions" value="kosher" /> Kosher</label>
            <label><input type="checkbox" name="dietaryRestrictions" value="vegan" /> Vegan</label>
            <label><input type="checkbox" name="dietaryRestrictions" defaultChecked value="gluten-free" /> Gluten-free</label>
          </fieldset>

          <label htmlFor="favColor">What is your favorite color?</label>
          <select id="favColor" name="favColor" defaultValue="blue" required>
            <option value="" disabled>-- Choose a color --</option>
            <option value="red">Red</option>
            <option value="orange">Orange</option>
            <option value="yellow">Yellow</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="indigo">Indigo</option>
            <option value="violet">Violet</option>
          </select>

          <button type="submit">Submit and log data</button>
        </form>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);
