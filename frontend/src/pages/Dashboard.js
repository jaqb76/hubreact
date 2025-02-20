// src/pages/Dashboard.js
import React from 'react';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  Box,
  Card,
  CardContent,
  CardHeader
} from '@mui/material';

const Dashboard = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
      </Box>
      
      <Grid container spacing={3}>
        {/* Przykładowe widgety */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Widget 1
            </Typography>
            <Typography variant="body1">
              Zawartość widgetu 1
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Widget 2
            </Typography>
            <Typography variant="body1">
              Zawartość widgetu 2
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Widget 3
            </Typography>
            <Typography variant="body1">
              Zawartość widgetu 3
            </Typography>
          </Paper>
        </Grid>

        {/* Większa sekcja na dole */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Statystyki" />
            <CardContent>
              <Typography variant="body1">
                Tutaj możesz umieścić bardziej szczegółowe statystyki lub wykresy
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
