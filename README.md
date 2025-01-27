# SWAAKON Course Comparison App

A modern web application for analyzing course similarities and relationships using AI-powered text analysis. The app helps users understand course overlaps and find similar courses based on course descriptions and literature.

## Features

- **Course Analysis**: Compare course content using advanced text embeddings
- **Smart Similarity Search**: Find similar courses based on content and learning objectives
- **AI-Powered Explanations**: Get detailed explanations of why courses are similar
- **Dark Mode Support**: Comfortable viewing experience with automatic theme detection
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Advanced Filtering**: Filter results by various course attributes

## Tech Stack

- React.js
- Material-UI (MUI)
- OpenAI API for embeddings and explanations
- Supabase for data storage

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file with:
   ```
   REACT_APP_OPENAI_API_KEY=your_api_key
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_key
   ```
4. Start the development server:
   ```bash
   npm start
   ```

## Usage

1. Enter course information (name, description, and optional literature)
2. Click "Analyze Course Overlap" to find similar courses
3. View similarity scores and AI-generated explanations
4. Use filters to refine search results
5. Toggle dark/light mode using the theme button

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
