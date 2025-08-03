import React, { useRef, useEffect } from 'react';

export const DrawingQuestion = ({ questionId, currentAnswer, handleAnswerChange }) => {
    const canvasRef = useRef(null);
    const drawingContext = useRef(null);
    const isDrawing = useRef(false);

    const getPointerPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const ctx = drawingContext.current;
        if (!ctx) return;
        isDrawing.current = true;
        const { x, y } = getPointerPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const ctx = drawingContext.current;
        if (!ctx) return;
        const { x, y } = getPointerPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        drawingContext.current.closePath();
        const canvas = canvasRef.current;
        const signatureData = canvas.toDataURL('image/png');
        handleAnswerChange(questionId, signatureData, 'dibujo');
    };

    const clearCanvas = () => {
        const ctx = drawingContext.current;
        if (!ctx) return;
        const canvas = canvasRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        handleAnswerChange(questionId, '', 'dibujo');
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.strokeStyle = '#000000';
        drawingContext.current = context;

        // Cargar firma inicial si existe
        if (currentAnswer) {
            const img = new Image();
            img.onload = () => {
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = currentAnswer;
        } else {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
        canvas.addEventListener('touchcancel', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseout', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
            canvas.removeEventListener('touchcancel', stopDrawing);
        };
    }, [questionId, currentAnswer]);

    return (
        <div className="signature-area">
            <canvas ref={canvasRef} width={600} height={300} className="signature-canvas" />
            <button type="button" onClick={clearCanvas} className="clear-canvas-btn">
                Clear Signature
            </button>
        </div>
    );
};