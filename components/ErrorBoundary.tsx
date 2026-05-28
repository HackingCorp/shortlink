'use client';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Une erreur est survenue
            </h2>
            <p className="text-gray-600 mb-6">
              Quelque chose s&apos;est mal pass&eacute;. Veuillez r&eacute;essayer.
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              R&eacute;essayer
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
