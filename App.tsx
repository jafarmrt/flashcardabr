import React from 'react';
import ReactDOM from 'react-dom/client';
import { useAppLogic, View, HealthStatus } from './hooks/useAppLogic';

import { Flashcard, Deck } from './types';
import Header from './components/Header';
import FlashcardList from './components/FlashcardList';
import FlashcardForm from './components/FlashcardForm';
import { StudyView } from './components/StudyView';
import { StatsView } from './components/StatsView';
import { PracticeView } from './components/ConversationView';
import Toast from './components/Toast';
import DeckList from './components/DeckList';
import { ChangelogView } from './components/ChangelogView';
import SettingsView from './components/SettingsView';
import { BulkAddView } from './components/BulkAddView';
import { StudySetupModal } from './components/StudySetupModal';
import { AchievementsView } from './components/AchievementsView';
import { ProfileView } from './components/ProfileView';
import { AuthView } from './components/AuthView';
import { FloatingActionButton } from './components/common/FloatingActionButton';
import { BottomNav } from './components/common/BottomNav';
import { AutoFixReportModal } from './components/AutoFixReportModal';

const StatusIndicator: React.FC<{ status: HealthStatus, label: string }> = ({ status, label }) => {
    const color = status === 'ok' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-yellow-500';
    const pulse = status === 'checking' ? 'animate-pulse' : '';
    return <div className="flex items-center gap-1.5" title={`${label}: ${status}`}><div className={`w-2 h-2 rounded-full ${color} ${pulse}`}></div><span>{label}</span></div>
};

const App: React.FC = () => {
    const {
        // State
        flashcards, decks, view, editingCard, toastMessage, isLoggedIn, currentUser, authLoading, appLoading,
        studyDeckId, isStudySetupModalOpen, dbStatus, apiStatus, freeDictApiStatus, mwDictApiStatus,
        settings, userProfile, streak, earnedAchievements, autoFixReport,
        // Handlers
        setView, showToast, handleAddCard, handleEditCard, handleDeleteCard, handleSaveCard,
        handleSaveProfile, handleBulkSaveCards, handleSessionEnd, handleExportCSV, handleImportCSV,
        handleResetApp, handleStudyDeck, handleStartStudySession, setIsStudySetupModalOpen,
        handleNavigate, handleRenameDeck, handleDeleteDeck, handleLogin, handleRegister, handleLogout,
        updateSettings, handleCheckAchievements, handleGoalUpdate, studyCards,
        handleCompleteCardDetails, handleAutoFixCards, handleStopAutoFix, autoFixProgress,
        handleCloseAutoFixReport, previousViewRef
    } = useAppLogic();

    const visibleFlashcards = flashcards.filter(c => !c.isDeleted);
    const visibleDecks = decks.filter(d => !d.isDeleted);
    const cardsForSetupModal = studyDeckId
        ? visibleFlashcards.filter(c => c.deckId === studyDeckId)
        : visibleFlashcards;

    const renderContent = () => {
        switch (view) {
            case 'STUDY':
                return <StudyView cards={studyCards} onExit={handleSessionEnd} awardXP={userProfile ? (points) => handleGoalUpdate('STUDY', points, true) : () => {}} />;
            case 'PRACTICE':
                return <PracticeView cards={visibleFlashcards} awardXP={userProfile ? (points) => handleGoalUpdate('QUIZ', points, true) : () => {}} onQuizComplete={(score) => {
                    handleCheckAchievements(score);
                    handleGoalUpdate('QUIZ', 1);
                }} />;
            case 'SETTINGS':
                return <SettingsView
                    settings={settings}
                    onUpdateSettings={updateSettings}
                    onExportCSV={handleExportCSV}
                    onImportCSV={handleImportCSV}
                    onResetApp={handleResetApp}
                    onNavigateToChangelog={() => setView('CHANGELOG')}
                    onNavigateToAchievements={() => setView('ACHIEVEMENTS')}
                    onNavigateToProfile={() => setView('PROFILE')}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                />
            case 'DECKS':
                return <DeckList
                    decks={visibleDecks}
                    cards={visibleFlashcards}
                    onStudyDeck={handleStudyDeck}
                    onRenameDeck={handleRenameDeck}
                    onDeleteDeck={handleDeleteDeck}
                    onViewAllCards={() => setView('LIST')}
                    onBulkAdd={() => setView('BULK_ADD')}
                    userProfile={userProfile}
                    streak={streak}
                />;
            case 'FORM':
                const editingCardDeckName = visibleDecks.find(d => d.id === editingCard?.deckId)?.name || '';
                return <FlashcardForm
                    card={editingCard}
                    decks={visibleDecks}
                    onSave={handleSaveCard}
                    onCancel={() => setView(previousViewRef.current)}
                    initialDeckName={editingCardDeckName}
                    showToast={showToast}
                    defaultApiSource={settings.defaultApiSource}
                />;
            case 'STATS':
                return <StatsView onBack={() => setView('DECKS')} />;
            case 'CHANGELOG':
                return <ChangelogView onBack={() => setView('SETTINGS')} />;
            case 'ACHIEVEMENTS':
                return <AchievementsView earnedAchievements={earnedAchievements} onBack={() => setView('SETTINGS')} />;
            case 'PROFILE':
                return <ProfileView
                    userProfile={userProfile}
                    streak={streak}
                    onSave={handleSaveProfile}
                    onBack={() => setView('SETTINGS')}
                    earnedAchievements={earnedAchievements}
                    onNavigateToAchievements={() => setView('ACHIEVEMENTS')}
                />;
            case 'BULK_ADD':
                return <BulkAddView
                    onSave={handleBulkSaveCards}
                    onCancel={() => setView('DECKS')}
                    showToast={showToast}
                    defaultApiSource={settings.defaultApiSource}
                    concurrency={settings.bulkAddConcurrency || 3}
                    aiTimeout={settings.bulkAddAiTimeout || 15}
                    dictTimeout={settings.bulkAddDictTimeout || 2.5}
                />;
            case 'LIST':
            default:
                return <FlashcardList 
                    cards={visibleFlashcards} 
                    decks={visibleDecks} 
                    onEdit={handleEditCard} 
                    onDelete={handleDeleteCard} 
                    onBackToDecks={() => setView('DECKS')} 
                    onCompleteCard={async (id) => { await handleCompleteCardDetails(id); }}
                    onAutoFixAll={handleAutoFixCards}
                    onStopAutoFix={handleStopAutoFix}
                    autoFixProgress={autoFixProgress}
                />;
        }
    };

    if (appLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                <div className="text-xl font-medium text-slate-600 dark:text-slate-300">Loading Lingua Cards...</div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return <AuthView onLogin={handleLogin} onRegister={handleRegister} isLoading={authLoading} />
    }

    return (
        <div className="min-h-screen font-sans flex flex-col">
            <Header
                onNavigate={handleNavigate}
                onAddCard={handleAddCard}
                isStudyDisabled={visibleFlashcards.length === 0}
                currentView={view}
            />
            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full pb-24 md:pb-8">
                {renderContent()}
            </main>

            <StudySetupModal
                isOpen={isStudySetupModalOpen}
                onClose={() => setIsStudySetupModalOpen(false)}
                onStart={handleStartStudySession}
                cards={cardsForSetupModal}
            />
            
            <AutoFixReportModal 
                isOpen={!!autoFixReport}
                onClose={handleCloseAutoFixReport}
                stats={autoFixReport}
            />

            {['LIST', 'DECKS'].includes(view) && <FloatingActionButton onClick={handleAddCard} />}
            <BottomNav currentView={view} onNavigate={handleNavigate} isStudyDisabled={visibleFlashcards.length === 0} />

            {toastMessage && <Toast message={toastMessage} />}
            <footer className="text-center py-4 pb-20 md:pb-4 text-xs text-slate-400 dark:text-slate-500">
                <div className="flex justify-center items-center gap-4 mb-2">
                    <StatusIndicator status={dbStatus} label="DB" />
                    <StatusIndicator status={apiStatus} label="AI API" />
                    <StatusIndicator status={freeDictApiStatus} label="Free Dict." />
                    <StatusIndicator status={mwDictApiStatus} label="MW Dict." />
                </div>
                <p>&copy; {new Date().getFullYear()} Lingua Cards. All Rights Reserved.</p>
            </footer>
        </div>
    );
};

export default App;