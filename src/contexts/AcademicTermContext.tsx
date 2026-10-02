import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AcademicTerm } from '../types';
import { getActiveAcademicTerm, academicTermsService } from '../services/academicTerms.service';

interface AcademicTermContextType {
  activeTerm: AcademicTerm | null;
  terms: AcademicTerm[];
  activeTermLoading: boolean;
  activeTermError: string | null;
  refetchActiveTerm: () => Promise<void>;
  refetchTerms: () => Promise<void>;
}

const AcademicTermContext = createContext<AcademicTermContextType | undefined>(undefined);

export const AcademicTermProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [activeTermLoading, setActiveTermLoading] = useState<boolean>(true);
  const [activeTermError, setActiveTermError] = useState<string | null>(null);

  const fetchActiveTerm = useCallback(async (forceRefresh = false) => {
    try {
      setActiveTermLoading(true);
      setActiveTermError(null);
      const term = await getActiveAcademicTerm();
      setActiveTerm(term);
    } catch (err: any) {
      console.warn('fetchActiveTerm fallback:', err);
      setActiveTerm({
        id: 'default-active-term',
        academic_year: '2026/2027',
        semester_type: 'GANJIL',
        is_active: true,
        starts_on: null,
        ends_on: null,
        year: '2026/2027',
        term: 'GANJIL',
      });
    } finally {
      setActiveTermLoading(false);
    }
  }, []);

  const fetchTerms = useCallback(async (_forceRefresh = false) => {
    try {
      const allTerms = await academicTermsService.getAcademicTerms();
      setTerms(allTerms);
    } catch (err) {
      console.warn('Failed to load academic terms list:', err);
    }
  }, []);

  // Initial load: ONLY load active term (1 query, cached)
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setActiveTermLoading(true);
        setActiveTermError(null);
        const term = await getActiveAcademicTerm();
        if (mounted) {
          if (term) {
            setActiveTerm(term);
          } else {
            setActiveTerm({
              id: 'default-active-term',
              academic_year: '2026/2027',
              semester_type: 'GANJIL',
              is_active: true,
              starts_on: null,
              ends_on: null,
              year: '2026/2027',
              term: 'GANJIL',
            });
          }
        }
      } catch (err: any) {
        if (mounted) {
          console.warn('Academic term initialization notice:', err);
          setActiveTerm({
            id: 'default-active-term',
            academic_year: '2026/2027',
            semester_type: 'GANJIL',
            is_active: true,
            starts_on: null,
            ends_on: null,
            year: '2026/2027',
            term: 'GANJIL',
          });
        }
      } finally {
        if (mounted) {
          setActiveTermLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      activeTerm,
      terms,
      activeTermLoading,
      activeTermError,
      refetchActiveTerm: () => fetchActiveTerm(true),
      refetchTerms: () => fetchTerms(true),
    }),
    [activeTerm, terms, activeTermLoading, activeTermError, fetchActiveTerm, fetchTerms]
  );

  return (
    <AcademicTermContext.Provider value={value}>
      {children}
    </AcademicTermContext.Provider>
  );
};

export function useAcademicTerm(): AcademicTermContextType {
  const context = useContext(AcademicTermContext);
  if (!context) {
    throw new Error('useAcademicTerm must be used within an AcademicTermProvider');
  }
  return context;
}

