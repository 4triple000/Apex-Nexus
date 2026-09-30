/**
 * Unreal Engine 5 C++ starter project generated from a game plan.
 * Opens with the Basic template map; the game mode adds a floor if needed, spawns enemies,
 * and runs the level goal. Keyboard/mouse and controller supported.
 */
import { randomUUID } from "crypto";
import type { GamePlan } from "./plan";
import { planMarkdown, type ProjectFile } from "./unity";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

function styleOf(camera: GamePlan["camera"]) {
  return camera === "First person" ? "FirstPerson" : camera === "Third person" ? "ThirdPerson" : camera === "Top-down" ? "TopDown" : "SideView";
}

export function unrealProject(name: string, title: string, plan: GamePlan, extraFiles: ProjectFile[] = []): ProjectFile[] {
  const API = `${name.toUpperCase()}_API`;
  const enemyCount = Math.min(12, Math.max(3, plan.characters.length * 2 + 2));
  const src = `${name}/Source/${name}`;
  return [
    { path: `${name}/${name}.uproject`, content: JSON.stringify({
      FileVersion: 3,
      EngineAssociation: "5.4",
      Category: "",
      Description: plan.pitch.slice(0, 200),
      Modules: [{ Name: name, Type: "Runtime", LoadingPhase: "Default" }],
    }, null, "\t") },
    { path: `${name}/Config/DefaultEngine.ini`, content: `[/Script/EngineSettings.GameMapsSettings]
GlobalDefaultGameMode=/Script/${name}.ApexGameMode
EditorStartupMap=/Engine/Maps/Templates/Template_Default.Template_Default
GameDefaultMap=/Engine/Maps/Templates/Template_Default.Template_Default

[/Script/Engine.RendererSettings]
r.DefaultFeature.AutoExposure=False
` },
    { path: `${name}/Config/DefaultGame.ini`, content: `[/Script/EngineSettings.GeneralProjectSettings]
ProjectID=${randomUUID().replace(/-/g, "").toUpperCase()}
ProjectName=${title.replace(/[\r\n]/g, " ")}
Description=${plan.pitch.replace(/[\r\n]+/g, " ").slice(0, 200)}
` },
    { path: `${name}/Config/DefaultInput.ini`, content: `[/Script/Engine.InputSettings]
DefaultPlayerInputClass=/Script/Engine.PlayerInput
DefaultInputComponentClass=/Script/Engine.InputComponent
+AxisMappings=(AxisName="MoveForward",Scale=1.000000,Key=W)
+AxisMappings=(AxisName="MoveForward",Scale=-1.000000,Key=S)
+AxisMappings=(AxisName="MoveForward",Scale=1.000000,Key=Gamepad_LeftY)
+AxisMappings=(AxisName="MoveRight",Scale=1.000000,Key=D)
+AxisMappings=(AxisName="MoveRight",Scale=-1.000000,Key=A)
+AxisMappings=(AxisName="MoveRight",Scale=1.000000,Key=Gamepad_LeftX)
+AxisMappings=(AxisName="Turn",Scale=1.000000,Key=MouseX)
+AxisMappings=(AxisName="Turn",Scale=2.000000,Key=Gamepad_RightX)
+AxisMappings=(AxisName="LookUp",Scale=-1.000000,Key=MouseY)
+AxisMappings=(AxisName="LookUp",Scale=-2.000000,Key=Gamepad_RightY)
+ActionMappings=(ActionName="Jump",Key=SpaceBar)
+ActionMappings=(ActionName="Jump",Key=Gamepad_FaceButton_Bottom)
+ActionMappings=(ActionName="Fire",Key=LeftMouseButton)
+ActionMappings=(ActionName="Fire",Key=Gamepad_RightTrigger)
+ActionMappings=(ActionName="Restart",Key=R)
+ActionMappings=(ActionName="Restart",Key=Gamepad_Special_Right)
` },
    { path: `${name}/Source/${name}.Target.cs`, content: `using UnrealBuildTool;

public class ${name}Target : TargetRules
{
	public ${name}Target(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("${name}");
	}
}
` },
    { path: `${name}/Source/${name}Editor.Target.cs`, content: `using UnrealBuildTool;

public class ${name}EditorTarget : TargetRules
{
	public ${name}EditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("${name}");
	}
}
` },
    { path: `${src}/${name}.Build.cs`, content: `using UnrealBuildTool;

public class ${name} : ModuleRules
{
	public ${name}(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore" });
	}
}
` },
    { path: `${src}/${name}.h`, content: `#pragma once

#include "CoreMinimal.h"
` },
    { path: `${src}/${name}.cpp`, content: `#include "${name}.h"
#include "Modules/ModuleManager.h"

IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, ${name}, "${name}");
` },
    { path: `${src}/ApexSettings.h`, content: `// Values from your Apex game plan. Change them here.
#pragma once

#include "CoreMinimal.h"

namespace ApexSettings
{
	enum class ECameraStyle : uint8 { FirstPerson, ThirdPerson, TopDown, SideView };

	inline constexpr ECameraStyle CameraStyle = ECameraStyle::${styleOf(plan.camera)};
	inline constexpr int32 EnemyCount = ${enemyCount};
	inline constexpr float PlayerHealth = 100.f;
	inline const TCHAR* Title = TEXT("${esc(title)}");
	inline const TCHAR* FirstLevel = TEXT("${esc(plan.levels[0]?.name ?? "Level 1")}");
	inline const TCHAR* FirstGoal = TEXT("${esc(plan.levels[0]?.goal ?? "Defeat every enemy")}");

	inline bool UsesMouseLook() { return CameraStyle == ECameraStyle::FirstPerson || CameraStyle == ECameraStyle::ThirdPerson; }
}
` },
    { path: `${src}/ApexCharacter.h`, content: `#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "ApexCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;

/** The player: movement and camera for your plan's camera style, plus a hitscan weapon. */
UCLASS()
class ${API} AApexCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AApexCharacter();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apex")
	float Health = 100.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apex")
	float WeaponDamage = 25.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apex")
	float ShotsPerSecond = 8.f;

	bool IsDead() const { return Health <= 0.f; }

protected:
	UPROPERTY(VisibleAnywhere, Category = "Apex")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, Category = "Apex")
	TObjectPtr<UCameraComponent> FollowCamera;

	UPROPERTY(VisibleAnywhere, Category = "Apex")
	TObjectPtr<UStaticMeshComponent> Body;

private:
	void MoveForward(float Value);
	void MoveRight(float Value);
	void Turn(float Value);
	void LookUp(float Value);
	void StartFire() { bFiring = true; }
	void StopFire() { bFiring = false; }
	void RestartLevel();
	void Fire();

	bool bFiring = false;
	float NextShotTime = 0.f;
};
` },
    { path: `${src}/ApexCharacter.cpp`, content: `#include "ApexCharacter.h"
#include "ApexSettings.h"
#include "ApexGameMode.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "Components/StaticMeshComponent.h"
#include "DrawDebugHelpers.h"
#include "Engine/DamageEvents.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "Kismet/GameplayStatics.h"
#include "UObject/ConstructorHelpers.h"

using namespace ApexSettings;

AApexCharacter::AApexCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	GetCapsuleComponent()->InitCapsuleSize(42.f, 96.f);
	Health = PlayerHealth;

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->JumpZVelocity = 620.f;
	Move->AirControl = 0.4f;
	Move->MaxWalkSpeed = 600.f;

	Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
	Body->SetupAttachment(GetCapsuleComponent());
	Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Body->SetRelativeScale3D(FVector(0.8f, 0.8f, 1.9f));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	if (Cylinder.Succeeded()) Body->SetStaticMesh(Cylinder.Object);

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(GetCapsuleComponent());
	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);

	switch (CameraStyle)
	{
	case ECameraStyle::FirstPerson:
		CameraBoom->TargetArmLength = 0.f;
		CameraBoom->SetRelativeLocation(FVector(0.f, 0.f, 64.f));
		CameraBoom->bUsePawnControlRotation = true;
		bUseControllerRotationYaw = true;
		Body->SetOwnerNoSee(true);
		break;
	case ECameraStyle::ThirdPerson:
		CameraBoom->TargetArmLength = 400.f;
		CameraBoom->SetRelativeLocation(FVector(0.f, 0.f, 60.f));
		CameraBoom->bUsePawnControlRotation = true;
		bUseControllerRotationYaw = false;
		Move->bOrientRotationToMovement = true;
		break;
	case ECameraStyle::TopDown:
		CameraBoom->SetUsingAbsoluteRotation(true);
		CameraBoom->SetRelativeRotation(FRotator(-60.f, 0.f, 0.f));
		CameraBoom->TargetArmLength = 1400.f;
		CameraBoom->bDoCollisionTest = false;
		bUseControllerRotationYaw = false;
		break;
	case ECameraStyle::SideView:
		CameraBoom->SetUsingAbsoluteRotation(true);
		CameraBoom->SetRelativeRotation(FRotator(-5.f, -90.f, 0.f));
		CameraBoom->TargetArmLength = 1200.f;
		CameraBoom->bDoCollisionTest = false;
		bUseControllerRotationYaw = false;
		Move->bOrientRotationToMovement = true;
		Move->SetPlaneConstraintEnabled(true);
		Move->SetPlaneConstraintNormal(FVector(0.f, 1.f, 0.f));
		break;
	}
}

void AApexCharacter::BeginPlay()
{
	Super::BeginPlay();
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		PC->bShowMouseCursor = CameraStyle == ECameraStyle::TopDown;
		if (CameraStyle == ECameraStyle::TopDown) PC->SetInputMode(FInputModeGameAndUI().SetHideCursorDuringCapture(false));
		else PC->SetInputMode(FInputModeGameOnly());
	}
}

void AApexCharacter::SetupPlayerInputComponent(UInputComponent* Input)
{
	Super::SetupPlayerInputComponent(Input);
	Input->BindAxis("MoveForward", this, &AApexCharacter::MoveForward);
	Input->BindAxis("MoveRight", this, &AApexCharacter::MoveRight);
	Input->BindAxis("Turn", this, &AApexCharacter::Turn);
	Input->BindAxis("LookUp", this, &AApexCharacter::LookUp);
	Input->BindAction("Jump", IE_Pressed, this, &ACharacter::Jump);
	Input->BindAction("Jump", IE_Released, this, &ACharacter::StopJumping);
	Input->BindAction("Fire", IE_Pressed, this, &AApexCharacter::StartFire);
	Input->BindAction("Fire", IE_Released, this, &AApexCharacter::StopFire);
	Input->BindAction("Restart", IE_Pressed, this, &AApexCharacter::RestartLevel);
}

void AApexCharacter::MoveForward(float Value)
{
	if (Value == 0.f || IsDead() || CameraStyle == ECameraStyle::SideView) return;
	FVector Dir = FVector::ForwardVector;
	if (UsesMouseLook() && Controller)
	{
		Dir = FRotationMatrix(FRotator(0.f, Controller->GetControlRotation().Yaw, 0.f)).GetUnitAxis(EAxis::X);
	}
	AddMovementInput(Dir, Value);
}

void AApexCharacter::MoveRight(float Value)
{
	if (Value == 0.f || IsDead()) return;
	FVector Dir = FVector::RightVector;
	if (CameraStyle == ECameraStyle::SideView) Dir = FVector::ForwardVector;
	else if (UsesMouseLook() && Controller)
	{
		Dir = FRotationMatrix(FRotator(0.f, Controller->GetControlRotation().Yaw, 0.f)).GetUnitAxis(EAxis::Y);
	}
	AddMovementInput(Dir, Value);
}

void AApexCharacter::Turn(float Value)
{
	if (UsesMouseLook()) AddControllerYawInput(Value);
}

void AApexCharacter::LookUp(float Value)
{
	if (UsesMouseLook()) AddControllerPitchInput(Value);
}

void AApexCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (IsDead()) return;

	// Top-down: face the mouse cursor
	if (CameraStyle == ECameraStyle::TopDown)
	{
		if (APlayerController* PC = Cast<APlayerController>(GetController()))
		{
			FHitResult Hit;
			if (PC->GetHitResultUnderCursor(ECC_Visibility, false, Hit))
			{
				FVector To = Hit.ImpactPoint - GetActorLocation();
				To.Z = 0.f;
				if (!To.IsNearlyZero()) SetActorRotation(To.Rotation());
			}
		}
	}

	const float Now = GetWorld()->GetTimeSeconds();
	if (bFiring && Now >= NextShotTime)
	{
		NextShotTime = Now + 1.f / FMath::Max(ShotsPerSecond, 0.1f);
		Fire();
	}
}

void AApexCharacter::Fire()
{
	const bool bFromCamera = UsesMouseLook();
	const FVector Start = bFromCamera ? FollowCamera->GetComponentLocation() : GetActorLocation();
	const FVector Dir = bFromCamera ? FollowCamera->GetForwardVector() : GetActorForwardVector();
	const FVector End = Start + Dir * 10000.f;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(ApexFire), false, this);
	FCollisionObjectQueryParams Objects;
	Objects.AddObjectTypesToQuery(ECC_Pawn);
	Objects.AddObjectTypesToQuery(ECC_WorldStatic);
	Objects.AddObjectTypesToQuery(ECC_WorldDynamic);

	FHitResult Hit;
	if (GetWorld()->LineTraceSingleByObjectType(Hit, Start, End, Objects, Params))
	{
		if (AActor* Target = Hit.GetActor())
		{
			UGameplayStatics::ApplyDamage(Target, WeaponDamage, GetController(), this, nullptr);
		}
	}
	DrawDebugLine(GetWorld(), Start, Hit.bBlockingHit ? Hit.ImpactPoint : End, FColor::Cyan, false, 0.05f, 0, 1.5f);
}

float AApexCharacter::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	const float Applied = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	if (IsDead()) return Applied;
	Health = FMath::Max(0.f, Health - DamageAmount);
	if (IsDead())
	{
		bFiring = false;
		if (AApexGameMode* GM = GetWorld()->GetAuthGameMode<AApexGameMode>()) GM->PlayerDefeated();
	}
	return DamageAmount;
}

void AApexCharacter::RestartLevel()
{
	UGameplayStatics::OpenLevel(this, FName(*UGameplayStatics::GetCurrentLevelName(this)));
}
` },
    { path: `${src}/ApexEnemy.h`, content: `#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "ApexEnemy.generated.h"

class UStaticMeshComponent;

/** Chases the player and attacks up close. Swap in a Behavior Tree when you want smarter enemies. */
UCLASS()
class ${API} AApexEnemy : public ACharacter
{
	GENERATED_BODY()

public:
	AApexEnemy();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apex")
	float Health = 50.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apex")
	float AttackRange = 160.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apex")
	float AttackDamage = 10.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apex")
	float AttackCooldown = 1.f;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Apex")
	TObjectPtr<UStaticMeshComponent> Body;

private:
	float NextAttackTime = 0.f;
};
` },
    { path: `${src}/ApexEnemy.cpp`, content: `#include "ApexEnemy.h"
#include "ApexGameMode.h"
#include "ApexSettings.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DamageEvents.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

AApexEnemy::AApexEnemy()
{
	PrimaryActorTick.bCanEverTick = true;
	AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;
	GetCapsuleComponent()->InitCapsuleSize(42.f, 96.f);
	GetCharacterMovement()->MaxWalkSpeed = 330.f;
	GetCharacterMovement()->bOrientRotationToMovement = true;
	bUseControllerRotationYaw = false;
	if (ApexSettings::CameraStyle == ApexSettings::ECameraStyle::SideView)
	{
		GetCharacterMovement()->SetPlaneConstraintEnabled(true);
		GetCharacterMovement()->SetPlaneConstraintNormal(FVector(0.f, 1.f, 0.f));
	}

	Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
	Body->SetupAttachment(GetCapsuleComponent());
	Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Body->SetRelativeScale3D(FVector(0.8f, 0.8f, 1.9f));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	if (Cylinder.Succeeded()) Body->SetStaticMesh(Cylinder.Object);
}

void AApexEnemy::BeginPlay()
{
	Super::BeginPlay();
	// BasicShapeMaterial has a "Color" parameter
	if (UMaterialInstanceDynamic* Mat = Body->CreateDynamicMaterialInstance(0))
	{
		Mat->SetVectorParameterValue(TEXT("Color"), FLinearColor(1.f, 0.2f, 0.55f));
	}
}

void AApexEnemy::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Player || Health <= 0.f) return;

	FVector To = Player->GetActorLocation() - GetActorLocation();
	To.Z = 0.f;
	if (To.Size() > AttackRange)
	{
		AddMovementInput(To.GetSafeNormal(), 1.f);
	}
	else if (GetWorld()->GetTimeSeconds() >= NextAttackTime)
	{
		NextAttackTime = GetWorld()->GetTimeSeconds() + AttackCooldown;
		UGameplayStatics::ApplyDamage(Player, AttackDamage, GetController(), this, nullptr);
	}
}

float AApexEnemy::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	if (Health <= 0.f) return 0.f;
	Health -= DamageAmount;
	if (Health <= 0.f)
	{
		if (AApexGameMode* GM = GetWorld()->GetAuthGameMode<AApexGameMode>()) GM->EnemyDefeated();
		Destroy();
	}
	return DamageAmount;
}
` },
    { path: `${src}/ApexGameMode.h`, content: `#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "ApexGameMode.generated.h"

/** Sets up the level (floor if missing, enemies) and tracks the goal. */
UCLASS()
class ${API} AApexGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AApexGameMode();

	virtual void BeginPlay() override;

	void EnemyDefeated();
	void PlayerDefeated();

	int32 EnemiesLeft = 0;
	FString Message;
};
` },
    { path: `${src}/ApexGameMode.cpp`, content: `#include "ApexGameMode.h"
#include "ApexCharacter.h"
#include "ApexEnemy.h"
#include "ApexHUD.h"
#include "ApexSettings.h"
#include "Components/LightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/World.h"
#include "EngineUtils.h"

AApexGameMode::AApexGameMode()
{
	DefaultPawnClass = AApexCharacter::StaticClass();
	HUDClass = AApexHUD::StaticClass();
}

void AApexGameMode::BeginPlay()
{
	Super::BeginPlay();
	UWorld* World = GetWorld();
	const bool bSide = ApexSettings::CameraStyle == ApexSettings::ECameraStyle::SideView;

	// Add a floor and a light if the level is empty
	FHitResult Hit;
	if (!World->LineTraceSingleByChannel(Hit, FVector(0, 0, 2000), FVector(0, 0, -5000), ECC_WorldStatic))
	{
		if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")))
		{
			AStaticMeshActor* Floor = World->SpawnActor<AStaticMeshActor>(FVector(0, 0, -150), FRotator::ZeroRotator);
			Floor->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
			Floor->GetStaticMeshComponent()->SetStaticMesh(Cube);
			Floor->SetActorScale3D(bSide ? FVector(120, 6, 1) : FVector(80, 80, 1));
		}
	}
	bool bHasLight = false;
	for (TActorIterator<ADirectionalLight> It(World); It; ++It) { bHasLight = true; break; }
	if (!bHasLight)
	{
		if (ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(FVector(0, 0, 1000), FRotator(-50, -30, 0)))
		{
			Sun->GetLightComponent()->SetMobility(EComponentMobility::Movable);
		}
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
	for (int32 i = 0; i < ApexSettings::EnemyCount; ++i)
	{
		const float Angle = (2.f * PI * i) / ApexSettings::EnemyCount;
		const FVector At = bSide
			? FVector(800.f + i * 500.f, 0.f, 200.f)
			: FVector(FMath::Cos(Angle) * 1800.f, FMath::Sin(Angle) * 1800.f, 200.f);
		if (World->SpawnActor<AApexEnemy>(AApexEnemy::StaticClass(), At, FRotator::ZeroRotator, Params)) ++EnemiesLeft;
	}
}

void AApexGameMode::EnemyDefeated()
{
	EnemiesLeft = FMath::Max(0, EnemiesLeft - 1);
	if (EnemiesLeft == 0 && Message.IsEmpty()) Message = TEXT("Level complete!  Press R to play again");
}

void AApexGameMode::PlayerDefeated()
{
	if (Message.IsEmpty()) Message = TEXT("You were defeated.  Press R to retry");
}
` },
    { path: `${src}/ApexHUD.h`, content: `#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "ApexHUD.generated.h"

/** Simple on-screen status: title, goal, enemies left, health and a crosshair. Replace with UMG later. */
UCLASS()
class ${API} AApexHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;
};
` },
    { path: `${src}/ApexHUD.cpp`, content: `#include "ApexHUD.h"
#include "ApexCharacter.h"
#include "ApexGameMode.h"
#include "ApexSettings.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/World.h"

void AApexHUD::DrawHUD()
{
	Super::DrawHUD();
	if (!Canvas || !GEngine) return;
	UFont* Font = GEngine->GetLargeFont();
	const AApexGameMode* GM = GetWorld()->GetAuthGameMode<AApexGameMode>();
	const AApexCharacter* Player = Cast<AApexCharacter>(GetOwningPawn());

	DrawText(FString::Printf(TEXT("%s  -  %s"), ApexSettings::Title, ApexSettings::FirstLevel), FLinearColor::White, 24, 20, Font, 1.1f);
	DrawText(FString::Printf(TEXT("Goal: %s    Enemies left: %d    Health: %.0f"), ApexSettings::FirstGoal, GM ? GM->EnemiesLeft : 0, Player ? Player->Health : 0.f),
		FLinearColor(0.85f, 0.85f, 1.f), 24, 52, Font, 0.9f);

	const float CX = Canvas->ClipX * 0.5f, CY = Canvas->ClipY * 0.5f;
	if (ApexSettings::UsesMouseLook())
	{
		DrawLine(CX - 10, CY, CX + 10, CY, FLinearColor::White, 1.5f);
		DrawLine(CX, CY - 10, CX, CY + 10, FLinearColor::White, 1.5f);
	}
	if (GM && !GM->Message.IsEmpty())
	{
		float W = 0, H = 0;
		GetTextSize(GM->Message, W, H, Font, 2.f);
		DrawText(GM->Message, FLinearColor::White, CX - W * 0.5f, CY - 80, Font, 2.f);
	}
}
` },
    { path: `${name}/.gitignore`, content: `Binaries/\nDerivedDataCache/\nIntermediate/\nSaved/\n.vs/\n.idea/\n*.sln\n*.VC.db\n` },
    { path: `${name}/README.md`, content: unrealReadme(name, title, plan) },
    { path: `${name}/GAME_PLAN.md`, content: planMarkdown(title, plan) },
    ...extraFiles,
  ];
}

function unrealReadme(name: string, title: string, plan: GamePlan) {
  return `# ${title} — Unreal Engine 5 starter project

Made with the Apex Engine. Your game plan is in GAME_PLAN.md.

## What you need
- A Windows PC or Mac that can run Unreal Engine 5 (a dedicated graphics card is recommended).
- **Epic Games Launcher** → Unreal Engine tab → install **Unreal Engine 5.4 or newer**.
- A C++ compiler: **Visual Studio 2022** with the "Game development with C++" workload (Windows), or **Xcode** (Mac).

## Open it
1. Unzip this folder.
2. Double-click \`${name}.uproject\`. If asked which engine version to use, pick the one you installed.
3. When Unreal says the modules are missing or out of date, click **Yes** to build them (takes a few minutes the first time).
4. The Basic map opens. Press **Play**. Your player, enemies and level goal are set up by \`ApexGameMode\`.

If the build fails, right-click \`${name}.uproject\` → **Generate Visual Studio project files**, open the .sln, and build the "Development Editor" target.

## Controls
${plan.controls.map((c) => `- ${c}`).join("\n")}
- R: restart after winning or losing

## What's inside (Source/${name})
- \`ApexSettings.h\` — values from your plan (camera style: ${plan.camera}, enemy count, health).
- \`ApexCharacter\` — player movement, camera and hitscan weapon.
- \`ApexEnemy\` — enemies that chase and attack.
- \`ApexGameMode\` — adds a floor if the level is empty, spawns enemies, tracks the goal.
- \`ApexHUD\` — simple on-screen status and crosshair.

## Next steps
- Replace the cylinders with real characters (Fab / Quixel have free assets).
- Build your first level in the editor. The game mode only adds a floor when the level has none.
- Back in Apex, keep refining the plan with the AI helper and download an updated project any time.
`;
}
