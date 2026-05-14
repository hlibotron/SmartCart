import os
import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.calibration import CalibratedClassifierCV
import joblib

# Щоб файли зберігалися саме в папці analytics, а не деінде
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def generate_data(n_samples=10000):
    print("⏳ [1/4] Генеруємо нелінійний датасет для XGBoost...")
    np.random.seed(42)

    base_price = np.random.uniform(10, 150, n_samples)
    competitor_price = base_price * np.random.uniform(0.3, 3.0, n_samples)
    days_since_last_purchase = np.clip(np.random.exponential(scale=14, size=n_samples).astype(int), 1, 90)
    user_loyalty = np.random.randint(1, 11, n_samples)

    rpi = base_price / competitor_price
    price_gap = base_price - competitor_price

    # Логіка попиту
    risk_score = (rpi - 1.0) * 12.0
    risk_score -= (user_loyalty - 5) * 0.8
    risk_score += (days_since_last_purchase - 14) * 0.05

    prob_churn = np.clip(1 / (1 + np.exp(-risk_score)), 0.01, 0.99)
    prob_buy = 1 - prob_churn
    purchased = np.random.binomial(1, prob_buy)

    df = pd.DataFrame({
        'our_price': base_price.round(2),
        'competitor_price': competitor_price.round(2),
        'rpi': rpi.round(3),
        'price_gap': price_gap.round(2),
        'days_since_last_purchase': days_since_last_purchase,
        'user_loyalty': user_loyalty,
        'purchased': purchased
    })

    csv_path = os.path.join(BASE_DIR, 'xgboost_pricing_data.csv')
    df.to_csv(csv_path, index=False)
    print(f"✅ Дані збережено: {csv_path}")
    return df


def train_model(df):
    print("⏳ [2/4] Підготовка даних та навчання XGBoost...")
    X = df[['our_price', 'competitor_price', 'rpi', 'price_gap', 'days_since_last_purchase', 'user_loyalty']]
    y = df['purchased']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Монотонні обмеження: як фічі впливають на ймовірність покупки
    constraints = {
        'our_price': -1,
        'competitor_price': 1,
        'rpi': -1,
        'price_gap': -1,
        'days_since_last_purchase': -1,
        'user_loyalty': 1
    }

    xgb_base = XGBClassifier(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.1,
        random_state=42,
        eval_metric='logloss',
        monotone_constraints=constraints
    )

    print("⏳ [3/4] Калібрування моделі (Isotonic Calibration)...")
    calibrated_xgb = CalibratedClassifierCV(estimator=xgb_base, method='isotonic', cv=3)
    calibrated_xgb.fit(X_train, y_train)

    predictions = calibrated_xgb.predict(X_test)
    prob_predictions = calibrated_xgb.predict_proba(X_test)[:, 1]

    print("\n✅ МОДЕЛЬ НАВЧЕНА ТА ВІДКАЛІБРОВАНА!")
    print(f"🎯 Точність (Accuracy): {accuracy_score(y_test, predictions):.2%}")
    print(f"📈 ROC-AUC: {roc_auc_score(y_test, prob_predictions):.3f}")

    model_path = os.path.join(BASE_DIR, 'xgb_pricing_model.pkl')
    joblib.dump(calibrated_xgb, model_path)
    print(f"💾 [4/4] Модель збережена як: {model_path}\n")


if __name__ == "__main__":
    dataset = generate_data()
    train_model(dataset)