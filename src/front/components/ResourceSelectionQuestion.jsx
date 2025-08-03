import React, { useMemo } from 'react';

export const ResourceSelectionQuestion = ({ question, resourcesToDisplay, currentAnswer, handleAnswerChange, handleSelectAllResources }) => {
    // Organiza los recursos por tipo de forma jerárquica
    const groupedResources = useMemo(() => {
        const groups = {
            Espacio: [],
            'Sub-Espacio': [],
            Objeto: [],
        };

        if (Array.isArray(resourcesToDisplay)) {
            resourcesToDisplay.forEach(resource => {
                if (groups[resource.type]) {
                    groups[resource.type].push(resource);
                }
            });
        }
        return groups;
    }, [resourcesToDisplay]);

    const allResourceIds = useMemo(() => {
        return (resourcesToDisplay || []).map(r => r.id);
    }, [resourcesToDisplay]);

    const isAllSelected = (currentAnswer || []).length === allResourceIds.length && allResourceIds.length > 0;

    return (
        <div className="options-group resource-selection">
            {resourcesToDisplay.length > 0 ? (
                <>
                    <div className="select-all-resources-control">
                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={(e) => handleSelectAllResources(question.id_pregunta, allResourceIds, e.target.checked)}
                            />
                            Seleccionar/Deseleccionar Todos
                        </label>
                    </div>

                    {/* Muestra los Espacios */}
                    {groupedResources.Espacio.length > 0 && (
                        <div className="resource-group">
                            <h5 className="resource-group-title">Espacios</h5>
                            {groupedResources.Espacio.map(resource => (
                                <label key={resource.id} className="option-item resource-item">
                                    <input
                                        type="checkbox"
                                        name={`question-${question.id_pregunta}`}
                                        value={resource.id}
                                        checked={(currentAnswer || []).includes(resource.id)}
                                        onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, 'seleccion_recursos')}
                                    />
                                    {resource.name}
                                </label>
                            ))}
                        </div>
                    )}
                    
                    {/* Muestra los Sub-Espacios */}
                    {groupedResources['Sub-Espacio'].length > 0 && (
                        <div className="resource-group">
                            <h5 className="resource-group-title">Sub-Espacios</h5>
                            {groupedResources['Sub-Espacio'].map(resource => (
                                <label key={resource.id} className="option-item resource-item">
                                    <input
                                        type="checkbox"
                                        name={`question-${question.id_pregunta}`}
                                        value={resource.id}
                                        checked={(currentAnswer || []).includes(resource.id)}
                                        onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, 'seleccion_recursos')}
                                    />
                                    {resource.name}
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Muestra los Objetos */}
                    {groupedResources.Objeto.length > 0 && (
                        <div className="resource-group">
                            <h5 className="resource-group-title">Objetos</h5>
                            {groupedResources.Objeto.map(resource => (
                                <label key={resource.id} className="option-item resource-item">
                                    <input
                                        type="checkbox"
                                        name={`question-${question.id_pregunta}`}
                                        value={resource.id}
                                        checked={(currentAnswer || []).includes(resource.id)}
                                        onChange={(e) => handleAnswerChange(question.id_pregunta, e.target.value, 'seleccion_recursos')}
                                    />
                                    {resource.name}
                                </label>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <p className="no-options-message">No hay recursos disponibles para esta pregunta en tu empresa.</p>
            )}
        </div>
    );
};